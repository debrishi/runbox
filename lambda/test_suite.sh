#!/bin/bash
# Container smoke tests. Start the image first, e.g.:
#   docker run --rm -p 9000:8080 code-lambda
# Every language is exercised across the same 7 scenarios:
#   success / runtime_error / compile_error / tle / mle / trunc / stdin
# runtime_error and compile_error both surface the catch-all ERROR code.
URL="http://localhost:9000/2015-03-31/functions/function/invocations"

t() {
    echo "[$1] $2"
    r=$(curl -s -m 15 -X POST "$URL" -d "$3")
    if echo "$r" | grep -q "$4"; then echo "  ✅ PASS"; else echo "  ❌ FAIL — $r"; fi
}

echo "=== WARMUP ==="
t warm is_warmup '{"is_warmup":true}' 'warm'

echo; echo "=== PYTHON ==="
t python success  '{"language":"python","code":"print(\"hi\")"}' '"statusCode": 200'
t python runtime  '{"language":"python","code":"raise ValueError(\"boom\")"}' 'ERROR'
t python compile  '{"language":"python","code":"1 +"}' 'ERROR'
t python tle      '{"language":"python","code":"while True: pass"}' 'ERROR_TLE'
t python mle      '{"language":"python","code":"x=\"a\"*(1000*1024*1024)"}' 'ERROR_MLE'
t python trunc    '{"language":"python","code":"print(\"x\"*5000)"}' 'OUTPUT_TRUNCATED'
t python stdin    '{"language":"python","code":"print(f\"Hi {input()}\")","stdin":"Deb"}' 'Hi Deb'

echo; echo "=== C++ ==="
t cpp success  '{"language":"cpp","code":"#include <iostream>\nint main(){std::cout<<\"hi\";}"}' '"statusCode": 200'
t cpp runtime  '{"language":"cpp","code":"#include <vector>\nint main(){std::vector<int> v; return v.at(5);}"}' 'ERROR'
t cpp compile  '{"language":"cpp","code":"int main(){ bogus(); }"}' 'ERROR'
t cpp tle      '{"language":"cpp","code":"int main(){while(1);}"}' 'ERROR_TLE'
t cpp mle      '{"language":"cpp","code":"#include <vector>\nint main(){ std::vector<long> v(200000000,1); }"}' 'ERROR_MLE'
t cpp trunc    '{"language":"cpp","code":"#include <iostream>\nint main(){ for(int i=0;i<5000;i++) std::cout<<\"x\"; }"}' 'OUTPUT_TRUNCATED'
t cpp stdin    '{"language":"cpp","code":"#include <iostream>\n#include <string>\nint main(){std::string n;std::cin>>n;std::cout<<\"Hi \"<<n;}","stdin":"Deb"}' 'Hi Deb'

echo; echo "=== JAVA ==="
t java success  '{"language":"java","code":"public class Main{public static void main(String[] a){System.out.println(\"hi\");}}"}' '"statusCode": 200'
t java runtime  '{"language":"java","code":"public class Main{public static void main(String[] a){throw new RuntimeException(\"boom\");}}"}' 'ERROR'
t java compile  '{"language":"java","code":"public class Main{ oops }"}' 'ERROR'
t java tle      '{"language":"java","code":"public class Main{public static void main(String[] a){while(true){}}}"}' 'ERROR_TLE'
t java mle      '{"language":"java","code":"public class Main{public static void main(String[] a){long[] x=new long[200_000_000];}}"}' 'ERROR_MLE'
t java trunc    '{"language":"java","code":"public class Main{public static void main(String[] a){StringBuilder s=new StringBuilder();for(int i=0;i<5000;i++)s.append(\"x\");System.out.print(s);}}"}' 'OUTPUT_TRUNCATED'
t java stdin    '{"language":"java","code":"import java.util.Scanner;public class Main{public static void main(String[] a){Scanner s=new Scanner(System.in);System.out.println(\"Hi \"+s.next());}}","stdin":"Deb"}' 'Hi Deb'

echo; echo "=== TYPESCRIPT ==="
t ts success  '{"language":"typescript","code":"const m: string = \"hi\"; console.log(m);"}' '"statusCode": 200'
t ts runtime  '{"language":"typescript","code":"throw new Error(\"boom\");"}' 'ERROR'
t ts compile  '{"language":"typescript","code":"const x: number ="}' 'ERROR'
t ts tle      '{"language":"typescript","code":"while(true){}"}' 'ERROR_TLE'
t ts mle      '{"language":"typescript","code":"const a:number[]=[]; while(true)a.push(Math.random());"}' 'ERROR_MLE'
t ts trunc    '{"language":"typescript","code":"process.stdout.write(\"x\".repeat(5000));"}' 'OUTPUT_TRUNCATED'
t ts stdin    '{"language":"typescript","code":"const d: string = require(\"fs\").readFileSync(0,\"utf8\").trim(); console.log(`Hi ${d}`);","stdin":"Deb"}' 'Hi Deb'

echo; echo "=== EDGE ==="
t edge empty    '{"language":"python","code":""}' 'No code provided'
t edge badlang  '{"language":"rust","code":"fn main(){}"}' 'Unsupported language'
