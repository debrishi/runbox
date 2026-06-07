#!/bin/bash
# Container smoke tests. Start the image first, e.g.:
#   docker run --rm -p 9000:8080 code-lambda
URL="http://localhost:9000/2015-03-31/functions/function/invocations"

t() {
    echo "[$1] $2"
    r=$(curl -s -m 15 -X POST "$URL" -d "$3")
    if echo "$r" | grep -q "$4"; then echo "  ✅ PASS"; else echo "  ❌ FAIL — $r"; fi
}

echo "=== WARMUP ==="
t warm is_warmup '{"is_warmup":true}' 'warm'

echo; echo "=== PYTHON ==="
t python success '{"language":"python","code":"print(\"hi\")"}' '"statusCode": 200'
t python timeout '{"language":"python","code":"while True: pass"}' 'ERROR_TLE'
t python oom     '{"language":"python","code":"x=\"a\"*(400*1024*1024)"}' 'ERROR_MLE'
t python trunc   '{"language":"python","code":"print(\"x\"*5000)"}' 'OUTPUT_TRUNCATED'
t python stdin   '{"language":"python","code":"print(input())","stdin":"hey"}' 'hey'

echo; echo "=== C++ ==="
t cpp  success  '{"language":"cpp","code":"#include <iostream>\nint main(){std::cout<<\"hi\";}"}' '"statusCode": 200'
t cpp  compile  '{"language":"cpp","code":"int main(){ bogus(); }"}' 'ERROR'
t cpp  timeout  '{"language":"cpp","code":"int main(){while(1);}"}' 'ERROR_TLE'
t cpp  oom      '{"language":"cpp","code":"#include <vector>\nint main(){ std::vector<long> v(200000000,1); }"}' 'ERROR_MLE'

echo; echo "=== JAVA ==="
t java success  '{"language":"java","code":"public class Main{public static void main(String[] a){System.out.println(\"hi\");}}"}' '"statusCode": 200'
t java compile  '{"language":"java","code":"public class Main{ oops }"}' 'ERROR'
t java oom      '{"language":"java","code":"public class Main{public static void main(String[] a){long[] x=new long[200_000_000];}}"}' 'ERROR_MLE'

echo; echo "=== TYPESCRIPT ==="
t ts   success  '{"language":"typescript","code":"const m: string = \"hi\"; console.log(m);"}' '"statusCode": 200'
t ts   timeout  '{"language":"typescript","code":"while(true){}"}' 'ERROR_TLE'
t ts   oom      '{"language":"typescript","code":"const a:number[]=[]; while(true)a.push(Math.random());"}' 'ERROR_MLE'

echo; echo "=== EDGE ==="
t edge empty    '{"language":"python","code":""}' 'No code provided'
t edge badlang  '{"language":"rust","code":"fn main(){}"}' 'Unsupported language'
