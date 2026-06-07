"""AWS Lambda handler that runs user code in C++, Java, Python, or TypeScript.

Sandboxing:
  * 10s subprocess timeout, killed as a process group (no orphan survivors).
  * 256MB address-space cap for languages that don't self-manage heap.
  * 50 forks per invocation, 10MB max file size, 4KB stdout/stderr cap.
  * Per-invocation temp dir, wiped in `finally`.
"""
import json
import os
import resource
import shutil
import signal
import subprocess
import tempfile
import time

MAX_TIME_SEC = 10                   # combined compile + run budget
MAX_MEMORY_MB = 256                 # per-language cap: ulimit -v / -Xmx / --max-old-space-size / ASan rss
MAX_FILE_SIZE_MB = 10               # RLIMIT_FSIZE — stops /tmp fill attacks
MAX_NPROC = 50                      # RLIMIT_NPROC
MAX_OUTPUT_SIZE = 4096              # bytes of stdout/stderr returned to the caller
TRUNCATED_MSG = f"\n[OUTPUT_TRUNCATED: Exceeded {MAX_OUTPUT_SIZE}B Limit]"

# Substrings we look for in stderr to surface a clean ERROR_MLE.
OOM_SIGNATURES = (
    "MemoryError",                      # Python
    "OutOfMemoryError",                 # JVM
    "JavaScript heap out of memory",    # Node
    "std::bad_alloc",                   # C++
    "AddressSanitizer: out of memory",  # C++ under ASan
    "rss limit exhausted",              # C++ ASan hard_rss_limit_mb (RSS cap)
)

# Each entry is {source, run}: write code to `source`, run one subprocess.
# No separate compile phase (C++ compiles inline); each `run` self-caps memory
# (Python ulimit -v, C++ ASan rss, Node --max-old-space-size, Java -Xmx).
LANG_CONFIG = {
    "python": {
        "source": "main.py",
        # ulimit -v caps address space; exec so timeout targets python, not sh.
        "run": ["sh", "-c", f"ulimit -v {MAX_MEMORY_MB * 1024}; exec python3 main.py"],
    },
    "cpp": {
        "source": "main.cpp",
        # Compile && run in one shell; exec so timeout targets the binary.
        # -fno-finite-loops keeps `while(1){}` (clang -O2 would delete it).
        # ASan needs ~8GB virtual, so memory is capped via its RSS limiter.
        "run": ["sh", "-c",
                "export ASAN_OPTIONS=abort_on_error=1:halt_on_error=1:"
                f"detect_leaks=0:hard_rss_limit_mb={MAX_MEMORY_MB}; "
                "clang++ -std=c++17 -O2 -fno-finite-loops -fsanitize=address "
                "-fno-omit-frame-pointer -g -o main main.cpp && exec ./main"],
    },
    "typescript": {
        "source": "main.ts",
        # Node 24 strips TypeScript types natively (stable since 23.6) — no flag.
        "run": ["node", f"--max-old-space-size={MAX_MEMORY_MB}", "main.ts"],
    },
    "java": {
        # `java Main.java` source-launch: compiles in-memory, allows any public
        # class name + Java 25 compact source; compile errors exit non-zero.
        "source": "Main.java",
        "run": ["java", f"-Xmx{MAX_MEMORY_MB}m", "Main.java"],
    },
}


def _response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload),
    }


def _read_capped(path):
    """Return up to MAX_OUTPUT_SIZE bytes; append truncation marker if larger."""
    try:
        size = os.path.getsize(path)
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            data = f.read(MAX_OUTPUT_SIZE)
        return data + TRUNCATED_MSG if size > MAX_OUTPUT_SIZE else data
    except OSError:
        return ""


def _preexec():
    """preexec_fn: uniform RLIMITs (nproc, fsize) + new session for group-kill.
    Memory caps live in each language's `run` command, not here.
    """
    def _try(fn):
        try:
            fn()
        except (ValueError, OSError):
            pass

    def apply_limits():
        _try(lambda: resource.setrlimit(resource.RLIMIT_NPROC, (MAX_NPROC, MAX_NPROC)))
        fsize = MAX_FILE_SIZE_MB * 1024 * 1024
        _try(lambda: resource.setrlimit(resource.RLIMIT_FSIZE, (fsize, fsize)))
        _try(os.setsid)
    return apply_limits


def _run(cmd, workdir, stdin_data, timeout=MAX_TIME_SEC):
    """Run a subprocess in its own process group.
    Returns (returncode, stdout, stderr, timed_out).
    """
    out_path = os.path.join(workdir, "stdout")
    err_path = os.path.join(workdir, "stderr")
    with open(out_path, "w") as out, open(err_path, "w") as err:
        p = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE if stdin_data is not None else subprocess.DEVNULL,
            stdout=out, stderr=err,
            preexec_fn=_preexec(),
            text=True, cwd=workdir,
        )
        try:
            p.communicate(input=stdin_data, timeout=timeout)
            return p.returncode, _read_capped(out_path), _read_capped(err_path), False
        except subprocess.TimeoutExpired:
            try:
                os.killpg(p.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            try:
                p.communicate(timeout=2)
            except subprocess.TimeoutExpired:
                pass
            return -1, _read_capped(out_path), _read_capped(err_path), True


def lambda_handler(event, context):
    # Function URL wraps the body as a string; direct invokes pass a dict.
    if isinstance(event, dict) and isinstance(event.get("body"), str):
        try:
            event = json.loads(event["body"])
        except json.JSONDecodeError:
            return _response(400, {"error": "Invalid JSON"})

    # EventBridge warmup ping.
    if event.get("is_warmup"):
        return _response(200, {"warm": True})

    code = event.get("code")
    lang = event.get("language", "python")
    stdin_data = event.get("stdin", "")

    if not code:
        return _response(400, {"error": "ERROR", "details": "No code provided"})
    if lang not in LANG_CONFIG:
        return _response(400, {"error": "ERROR", "details": f"Unsupported language: {lang}"})

    cfg = LANG_CONFIG[lang]

    workdir = None
    try:
        workdir = tempfile.mkdtemp(prefix="run_")
        with open(os.path.join(workdir, cfg["source"]), "w") as f:
            f.write(code)

        # One subprocess covers compile + run; run_ms is wall-clock around it
        # (toy programs floor at ~10ms from fork/exec, and -O2 may fold loops).
        t0 = time.perf_counter()
        rc, output, error, to = _run(cfg["run"], workdir, stdin_data,
                                     timeout=MAX_TIME_SEC)
        run_ms = round((time.perf_counter() - t0) * 1000)
        if to:
            return _response(400, {"error": "ERROR_TLE"})
        if rc != 0:
            # SIGKILL with no OOM signature = cgroup OOM-killer backstop.
            if rc == -signal.SIGKILL or any(sig in error for sig in OOM_SIGNATURES):
                return _response(400, {"error": "ERROR_MLE"})
            # Catch-all: runtime crash or compile failure (both exit non-zero).
            return _response(400, {
                "error": "ERROR", "output": output, "details": error,
                "run_ms": run_ms,
            })
        return _response(200, {
            "output": output,
            "run_ms": run_ms,
        })

    except Exception as e:
        return _response(500, {"error": "ERROR", "details": str(e)})
    finally:
        if workdir:
            shutil.rmtree(workdir, ignore_errors=True)
