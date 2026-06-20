#!/bin/bash
# Extended stress suite — covers scenarios test_suite.sh / test_stdin.sh don't.
URL="http://localhost:9000/2015-03-31/functions/function/invocations"
PASS=0; FAIL=0

t() {  # name, expected-substring, payload
    r=$(curl -s -m 15 -X POST "$URL" -d "$3")
    if echo "$r" | grep -q "$2"; then
        echo "✅ $1"; ((PASS++))
    else
        echo "❌ $1"; echo "   expected: $2"; echo "   got: $r"; ((FAIL++))
    fi
}

echo "=== Function URL body wrapping ==="
# Function URL delivers the JSON payload as a STRING in event['body'].
t "fn-url: body string unwrap" "5" \
    '{"body":"{\"language\":\"python\",\"code\":\"print(2+3)\"}"}'
t "fn-url: invalid json body" "Invalid JSON" \
    '{"body":"{not json"}'

echo; echo "=== Network isolation (should timeout per README) ==="
# No NAT gateway on real Lambda -> outbound hangs till 10s timeout.
# Docker container HAS network, so this test only verifies behaviour when
# the code itself can't reach a host within 10s.
t "python: DNS resolve junk host" "ERROR_TLE" \
    '{"language":"python","code":"import socket; socket.create_connection((\"10.255.255.1\", 80), timeout=30)"}'

echo; echo "=== Fork bomb / RLIMIT_NPROC ==="
# Note: RLIMIT_NPROC applies per real-uid. The Lambda RIE container runs as
# root locally, so NPROC isn't enforced here. On real AWS Lambda the function
# runs as a non-root user and the limit trips. Just verify the code completes
# without wedging the container.
t "python: many forks handled" "statusCode\": 200" \
    '{"language":"python","code":"import os\nfor _ in range(30):\n  if os.fork()==0: os._exit(0)\nprint(\"ok\")"}'

echo; echo "=== Stderr vs stdout channels ==="
t "python: stderr captured" "oops-on-stderr" \
    '{"language":"python","code":"import sys; sys.stderr.write(\"oops-on-stderr\"); sys.exit(1)"}'
t "python: mixed streams" "on-stdout" \
    '{"language":"python","code":"import sys; print(\"on-stdout\"); sys.stderr.write(\"on-stderr\")"}'

echo; echo "=== Warm-start isolation (workdir wiped between invokes) ==="
# Invoke 1 writes a file; invoke 2 tries to read it — must fail.
t "warm: inv1 writes file" "wrote" \
    '{"language":"python","code":"open(\"leak.txt\",\"w\").write(\"secret\"); print(\"wrote\")"}'
t "warm: inv2 cannot read prev file" "NoFile\\|no_file" \
    '{"language":"python","code":"import os\nprint(\"NoFile\" if not os.path.exists(\"leak.txt\") else open(\"leak.txt\").read())"}'

echo; echo "=== Unicode & special characters ==="
# json.dumps default escapes non-ASCII; grep for the escaped form.
t "python: unicode (json-escaped)" "u00e9llo" \
    '{"language":"python","code":"print(\"héllo-λ-日本\")"}'
t "cpp: unicode literal (json-escaped)" "u00e9llo" \
    '{"language":"cpp","code":"#include <iostream>\nint main(){std::cout<<\"héllo\";}"}'

echo; echo "=== Large stdin ==="
# Build a 10KB stdin payload and sum 1000 numbers.
big_stdin=$(python3 -c 'print("\\n".join(str(i) for i in range(1,1001)))')
t "python: sum 1..1000 via stdin" "500500" \
    "{\"language\":\"python\",\"code\":\"import sys; print(sum(int(l) for l in sys.stdin))\",\"stdin\":\"${big_stdin}\"}"

echo; echo "=== CPU-bound (just under limit) ==="
t "python: ~2s work completes" "done-fast" \
    '{"language":"python","code":"s=0\nfor i in range(5_000_000): s+=i\nprint(\"done-fast\")"}'

echo; echo "=== Java specifics ==="
t "java: compact source / instance main (JEP 512) runs" "compact-ok" \
    '{"language":"java","code":"void main(){ System.out.println(\"compact-ok\"); }"}'
t "java: non-public class now runs (no checker)" "nope" \
    '{"language":"java","code":"class Wrong { public static void main(String[] a){ System.out.println(\"nope\"); } }"}'
t "java: public class Foo (LeetCode model) works" "hello-from-foo" \
    '{"language":"java","code":"public class Foo { public static void main(String[] a){ System.out.println(\"hello-from-foo\"); } }"}'
t "java: exception on stderr" "ArithmeticException" \
    '{"language":"java","code":"public class Main{public static void main(String[] a){int x=1/0;}}"}'
t "java: System.err" "err-channel" \
    '{"language":"java","code":"public class Main{public static void main(String[] a){System.err.println(\"err-channel\"); System.exit(2);}}"}'

echo; echo "=== TypeScript specifics ==="
t "ts: type is stripped, runs" "42" \
    '{"language":"typescript","code":"const add = (a: number, b: number): number => a+b; console.log(add(20,22));"}'
t "ts: runtime error" "ReferenceError\\|is not defined" \
    '{"language":"typescript","code":"console.log(doesNotExist);"}'

echo; echo "=== C++ specifics ==="
t "cpp: segfault -> non-zero rc" "statusCode\": 400" \
    '{"language":"cpp","code":"int main(){ volatile int* p=nullptr; *p=1; return 0; }"}'
t "cpp: exit code 7 surfaces as failure" "statusCode\": 400" \
    '{"language":"cpp","code":"int main(){ return 7; }"}'
t "cpp: ASan catches use-after-free" "heap-use-after-free" \
    '{"language":"cpp","code":"#include <cstdlib>\n#include <cstdio>\nint main(int argc,char**){ int* p=(int*)malloc(16); p[0]=argc; free(p); printf(\"%d\\n\",p[0]); }"}'

echo; echo "=== Payload edge cases ==="
t "edge: missing language defaults to python" "ok" \
    '{"code":"print(\"ok\")"}'
t "edge: whitespace code still runs" "statusCode\": 200" \
    '{"language":"python","code":"   \n\t\n"}'
t "edge: language case-sensitive" "Unsupported" \
    '{"language":"Python","code":"print(1)"}'

echo; echo "=== Output truncation (all languages) ==="
t "py: truncation marker" "OUTPUT_TRUNCATED" \
    '{"language":"python","code":"print(\"x\"*5000)"}'
t "cpp: truncation marker" "OUTPUT_TRUNCATED" \
    '{"language":"cpp","code":"#include <iostream>\nint main(){ for(int i=0;i<5000;i++) std::cout<<\"x\"; }"}'
t "java: truncation marker" "OUTPUT_TRUNCATED" \
    '{"language":"java","code":"public class Main{public static void main(String[] a){StringBuilder s=new StringBuilder();for(int i=0;i<5000;i++)s.append(\"x\");System.out.print(s);}}"}'
t "ts: truncation marker" "OUTPUT_TRUNCATED" \
    '{"language":"typescript","code":"process.stdout.write(\"x\".repeat(5000));"}'

echo; echo "=== ERROR field (all languages) ==="
t "py: ERROR code" "ERROR" \
    '{"language":"python","code":"raise ValueError(\"boom\")"}'
t "cpp: ERROR code" "ERROR" \
    '{"language":"cpp","code":"int main(){ return 1; }"}'
t "java: ERROR code" "ERROR" \
    '{"language":"java","code":"public class Main{public static void main(String[] a){throw new RuntimeException(\"boom\");}}"}'
t "ts: ERROR code" "ERROR" \
    '{"language":"typescript","code":"throw new Error(\"boom\");"}'

echo; echo "=== Process group kill on timeout (no orphan children) ==="
# Grandchild sleeps 30s then tries to write. If the process group is killed,
# the file never appears — so a follow-up invocation reports it missing.
t "orphan kill: parent times out" "ERROR_TLE\|ERROR" \
    '{"language":"python","code":"import os,time\nif os.fork()==0:\n  time.sleep(30)\n  open(\"/tmp/leaked\",\"w\").write(\"!\")\nelse:\n  time.sleep(30)"}'
sleep 4  # give the would-be orphan time to run if it wasn't killed
t "orphan kill: grandchild did not write" "NotFound" \
    '{"language":"python","code":"import os; print(\"NotFound\" if not os.path.exists(\"/tmp/leaked\") else \"LEAK\")"}'

echo; echo "=== Disk quota (RLIMIT_FSIZE) ==="
# 20 MB streaming write > 10 MB RLIMIT_FSIZE -> SIGXFSZ, non-zero exit.
t "disk: file size cap trips" "ERROR" \
    '{"language":"python","code":"f=open(\"/tmp/bigfile\",\"wb\")\nchunk=b\"x\"*(1024*1024)\nfor _ in range(20): f.write(chunk)\nprint(\"done\")"}'

echo; echo "=== combined compile+run timeout ==="
# There is no separate compile phase anymore: compile + execution share one
# subprocess bounded by MAX_RUN_TIMEOUT (MAX_COMP_TIMEOUT + MAX_EXEC_TIMEOUT).
# A slow compile or a long-running program both surface as ERROR_TLE.
echo "⏭️  skipped (reliably stalling clang past the budget via user source is impractical)"

echo; echo "=== Summary ==="
echo "Passed: $PASS, Failed: $FAIL"
[ $FAIL -eq 0 ] && echo "🎉 all passed" || echo "⚠️  some failed"
exit $FAIL
