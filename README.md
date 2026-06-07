# Serverless Code Runner — System Design

**Live:** <https://code-playground-e3s.pages.dev/>

## Architecture Overview

A synchronous, single-Lambda execution engine optimised for zero-maintenance, low latency, and strict cost control.

| Component | Technology | Responsibility |
| :--- | :--- | :--- |
| **Editor** | React + Monaco Editor | UI, payload construction, HTTP fetch with AbortController |
| **Runner** | AWS Lambda (Python orchestrator) via Function URL | Payload validation, subprocess sandboxing, output formatting. Executes user code in **C++, Java, Python, or TypeScript**. |
| **Heater** | Amazon EventBridge (cron) | Pings Lambda every 5 min with `{"is_warmup": true}` to prevent cold starts |

**Network topology:** Lambda runs inside a VPC with no NAT gateway. All outbound calls from user code hang until the 10s subprocess timeout kills them — no data exfiltration possible. EventBridge invokes via Function URL inbound (public HTTPS), so the warmer is unaffected. Add a CloudWatch Logs VPC endpoint from the start to preserve observability.

---

## The 10 / 20 / 30 Cascading Timeout Strategy

Each layer covers the failure mode of the one inside it.

| Limit | Enforced By | Behaviour |
| :--- | :--- | :--- |
| **10s** | `subprocess.run(timeout=10)` | User code forcefully killed. Returns `TIME_LIMIT_EXCEEDED`. |
| **20s** | Lambda configuration timeout | 10s buffer for the orchestrator to clean up and return HTTP response. |
| **30s** | React `AbortController` | Accounts for cold-start + 10s execution + network transit. UI resets gracefully instead of freezing. |

---

## Execution Limits & Sandboxing

| Limit | Mechanism | Notes |
| :--- | :--- | :--- |
| **Memory — 256MB** | Python `resource.setrlimit(RLIMIT_AS)`; Java `-Xmx`; Node `--max-old-space-size`; C++ ASan `hard_rss_limit_mb` | Each runtime caps itself at 256MB and surfaces `MEMORY_LIMIT_EXCEEDED` (`MemoryError` / `OutOfMemoryError` / heap-OOM). `RLIMIT_AS` caps virtual address space, not RSS — test with realistic workloads as shared library mappings count toward the limit. **C++ is the exception:** ASan reserves ~8GB of virtual space, so a virtual cap (`RLIMIT_AS`) can't be applied (`cap_memory=False`). Instead ASan's own *RSS-based* limiter (`ASAN_OPTIONS=hard_rss_limit_mb=256`) caps resident memory at 256MB and aborts with `hard rss limit exhausted` on breach. Because a monitor thread polls RSS, the kill can overshoot slightly; the cgroup OOM-killer `SIGKILL` (returncode `-9`, not from a timeout) remains the backstop for allocation bursts faster than the poll interval — both map to `MEMORY_LIMIT_EXCEEDED`. |
| **Output — 4KB** | `stdout`/`stderr` written to `/tmp`, first 4096 bytes read back | Prevents `while True: print()` memory exhaustion. |
| **Network — none** | VPC with no NAT gateway | All outbound connections time out at 10s subprocess limit. |
| **Concurrency — 10–20** | Lambda Reserved Concurrency | Hard cap on simultaneous executions — primary abuse cost control. |

**Temp file cleanup:** All execution files are created inside a unique `tempfile.mkdtemp()` directory per invocation and wiped with `shutil.rmtree()` in a `finally` block — catches everything the subprocess writes, not just the primary file.

---

## Edge Cases & Design Decisions

**API Gateway 29s drop**
API Gateway hard-drops connections at 29s, causing `504` errors even when the backend is healthy. Skipped entirely in favour of Lambda Function URLs, which support connections up to 15 minutes natively. Trade-off: no built-in rate limiting — mitigated by Reserved Concurrency cap.

**Zombie Lambdas / double billing**
A proxy architecture (Server Lambda → Execution Lambda) bills for two Lambdas simultaneously. Consolidated into a single Lambda that receives the Function URL request directly. Zero idle compute.

**Warm-start data leaks**
Lambda reuses containers across invocations. All state is scoped to `lambda_handler` local scope. Temp directory is wiped in `finally` before returning — User B cannot read User A's artifacts.

**UX during long executions**
A 10s+ synchronous wait feels like a crashed tab. The Run button disables on click and a dynamic timer (`Running: 1s… 2s…`) mounts immediately to confirm the connection is alive.

---

## Warmer Behaviour & Concurrency

The EventBridge warmer keeps **one** container pre-initialised. Because executions can run up to 10s, the overlap window where a second simultaneous user triggers a cold start is wide — wider than for a typical low-latency API.

To keep multiple containers warm cheaply, send 2–3 concurrent warmup pings from EventBridge in parallel. Cost is negligible since warmup payloads return immediately.

---

## Known Limitations (Post-MVP)

- **Additional runtimes:** Beyond the four supported languages (C++, Java, Python, TypeScript), new runtimes must be bundled into the container image. Lambda has a 10GB image limit, so several more can be added without restructuring.
- **No queue:** At Reserved Concurrency cap, excess requests get throttle errors immediately with no retry. Acceptable at low traffic; add an SQS queue when concurrency becomes a concern.
- **No auth on Function URL:** Reserved Concurrency is the only abuse control. A HMAC token or Cloudflare Turnstile would meaningfully reduce the attack surface.