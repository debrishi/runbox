// Per-language starter code for the Monaco editor.
// Each snippet reads a single token from stdin and prints "Hello <token>!"
// — minimal so a first run produces obvious output without distractions.
export const STARTER_CODE = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    string name;
    cin >> name;
    cout << "Hello " << name << "!" << endl;
    return 0;
}`,
  java: `class Main {
    public static void main(String[] args) {
        String name= IO.readln();
        IO.println("Hello " + name + "!");
    }
}`,
  python: `name = input()
print(f"Hello {name}!")`,
  typescript: `// @ts-nocheck
const name: string = require("fs").readFileSync(0, "utf-8").trim();
console.log(\`Hello \${name}!\`);`,
};
