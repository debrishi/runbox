#!/bin/bash
# Stdin tests for all 4 supported languages against the local container.
URL="http://localhost:9000/2015-03-31/functions/function/invocations"
PASS=0; FAIL=0

t() {
    r=$(curl -s -m 15 -X POST "$URL" -d "$3")
    if echo "$r" | grep -q "$2"; then echo "✅ $1"; ((PASS++)); else echo "❌ $1 — $r"; ((FAIL++)); fi
}

echo "=== Python ==="
t "py: single"   "Hi Deb"   '{"language":"python","code":"print(f\"Hi {input()}\")","stdin":"Deb"}'
t "py: multi"    "8"        '{"language":"python","code":"print(int(input())+int(input()))","stdin":"5\n3"}'

echo; echo "=== C++ ==="
t "cpp: single"  "Hi Deb"   '{"language":"cpp","code":"#include <iostream>\n#include <string>\nint main(){std::string n;std::cin>>n;std::cout<<\"Hi \"<<n;}","stdin":"Deb"}'
t "cpp: multi"   "8"        '{"language":"cpp","code":"#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b;}","stdin":"5\n3"}'

echo; echo "=== Java ==="
t "java: single" "Hi Deb"   '{"language":"java","code":"import java.util.Scanner;public class Main{public static void main(String[] a){Scanner s=new Scanner(System.in);System.out.println(\"Hi \"+s.next());}}","stdin":"Deb"}'
t "java: multi"  "8"        '{"language":"java","code":"import java.util.Scanner;public class Main{public static void main(String[] a){Scanner s=new Scanner(System.in);System.out.println(s.nextInt()+s.nextInt());}}","stdin":"5\n3"}'

echo; echo "=== TypeScript ==="
t "ts: single"   "Hi Deb"   '{"language":"typescript","code":"const d: string = require(\"fs\").readFileSync(0,\"utf8\").trim(); console.log(`Hi ${d}`);","stdin":"Deb"}'
t "ts: multi"    "8"        '{"language":"typescript","code":"const ls: number[] = require(\"fs\").readFileSync(0,\"utf8\").trim().split(\"\\n\").map(Number); console.log(ls[0]+ls[1]);","stdin":"5\n3"}'

echo; echo "=== Summary ==="
echo "Passed: $PASS, Failed: $FAIL"
[ $FAIL -eq 0 ] && echo "✅ all passed" || echo "❌ some failed"
exit $FAIL
