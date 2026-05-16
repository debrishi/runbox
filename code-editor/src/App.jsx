import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Moon,
  Sun,
  ChevronDown,
  Save,
  Maximize2,
  Minimize2,
  Terminal,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle2
} from 'lucide-react';
import Editor from '@monaco-editor/react';

// Display label -> Lambda `language` field + Monaco language id.
const LANGUAGES = [
  { label: 'C++', api: 'cpp', monaco: 'cpp' },
  { label: 'Java', api: 'java', monaco: 'java' },
  { label: 'Python', api: 'python', monaco: 'python' },
  { label: 'TypeScript', api: 'typescript', monaco: 'typescript' },
];

// Per-language starter code. Picked to demo stdin + a small loop.
const STARTER_CODE = {
  cpp: `#include <iostream>
using namespace std;

int main() {
    string name;
    // Type a name in the stdin box below!
    cin >> name;
    cout << "Hello " << name << "!" << endl;

    for (int i = 1; i <= 5; i++) {
        cout << "Count: " << i << endl;
    }
    return 0;
}`,
  java: `public class Main {
    public static void main(String[] args) {
        java.util.Scanner sc = new java.util.Scanner(System.in);
        String name = sc.hasNext() ? sc.next() : "World";
        System.out.println("Hello " + name + "!");
        for (int i = 1; i <= 5; i++) {
            System.out.println("Count: " + i);
        }
    }
}`,
  python: `import sys

name = sys.stdin.readline().strip() or "World"
print(f"Hello {name}!")
for i in range(1, 6):
    print(f"Count: {i}")`,
  typescript: `const name: string = (await new Promise<string>((resolve) => {
  let buf = "";
  process.stdin.on("data", (c) => (buf += c));
  process.stdin.on("end", () => resolve(buf.trim() || "World"));
})) as string;

console.log(\`Hello \${name}!\`);
for (let i = 1; i <= 5; i++) console.log(\`Count: \${i}\`);`,
};

// File extensions used by the Save button. Java compiler requires the
// filename to match the public class, hence Main.java rather than code.java.
const FILENAME = {
  cpp: 'code.cpp',
  java: 'Main.java',
  python: 'code.py',
  typescript: 'code.ts',
};

// Resolve the deployed Lambda URL at build time. Empty string -> mock mode.
const LAMBDA_URL = import.meta.env.VITE_LAMBDA_URL || '';

// 30s outermost timeout — matches the README's 10/20/30 cascading timeout strategy.
const REQUEST_TIMEOUT_MS = 30_000;

// Map Lambda error codes to a UI-friendly status label.
const ERROR_LABEL = {
  COMPILATION_ERROR: 'Compilation Error',
  COMPILE_TIME_LIMIT_EXCEEDED: 'Compile Time Limit Exceeded',
  RUNTIME_ERROR: 'Runtime Error',
  TIME_LIMIT_EXCEEDED: 'Time Limit Exceeded',
  MEMORY_LIMIT_EXCEEDED: 'Memory Limit Exceeded',
};

// Status -> visual severity. "Output Limit Exceeded" is a successful run that
// just produced more than 4KB of stdout, so it's a warning, not an error.
const WARNING_STATUSES = new Set(['Output Limit Exceeded']);
const SUCCESS_STATUSES = new Set(['Finished']);
function getStatusKind(status) {
  if (SUCCESS_STATUSES.has(status)) return 'success';
  if (WARNING_STATUSES.has(status)) return 'warning';
  return 'error';
}

export default function App() {
  const [theme, setTheme] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  // Track OS theme changes so the playground stays in sync if the user toggles
  // their system theme while the tab is open. The manual sun/moon toggle still
  // overrides this — once the user clicks it, that choice sticks until the
  // next OS-level change.
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setTheme(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  // Code is per-language so switching languages doesn't blow away your work.
  const [codeByLang, setCodeByLang] = useState(STARTER_CODE);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const code = codeByLang[language.api];
  const [stdin, setStdin] = useState('Developer');
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds, ticks while running
  const [stdinExpanded, setStdinExpanded] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  // AbortController for the in-flight fetch — lets us cancel on unmount.
  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Drive the running-timer at 1Hz while a request is in flight.
  useEffect(() => {
    if (!isRunning) return;
    setElapsed(0);
    const t0 = performance.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((performance.now() - t0) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [isRunning]);

  // Toggle Theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Real Lambda execution — fetch the deployed Function URL and translate the
  // response into the same {status, runtime, stdout, error} shape the UI uses.
  const handleRunCode = async () => {
    if (!LAMBDA_URL) {
      setOutput({
        status: 'Configuration Error',
        runtime: null,
        stdout: '',
        error: 'VITE_LAMBDA_URL is not set. Add it to .env.local and restart the dev server.',
      });
      return;
    }

    setIsRunning(true);
    setOutput(null);
    if (isFullScreen) setIsFullScreen(false);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const startedAt = performance.now();
    try {
      const res = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: language.api, code, stdin }),
        signal: controller.signal,
      });

      const runtime = Math.round(performance.now() - startedAt);
      let payload;
      try {
        payload = await res.json();
      } catch {
        payload = { error: 'INVALID_RESPONSE', details: await res.text() };
      }

      // Success: { output: "..." }, possibly with the truncation marker.
      if (res.ok && typeof payload.output === 'string') {
        const truncated = payload.output.includes('[OUTPUT_TRUNCATED');
        setOutput({
          status: truncated ? 'Output Limit Exceeded' : 'Finished',
          runtime,
          stdout: payload.output,
          error: null,
        });
        return;
      }

      // Error envelopes from the Lambda — see lambda.py for the full set.
      const errCode = payload.error || `HTTP ${res.status}`;
      const label = ERROR_LABEL[errCode] || errCode;
      // RUNTIME_ERROR carries partial stdout; everything else uses `details`.
      const details = payload.details || '';
      const partialStdout = typeof payload.output === 'string' ? payload.output : '';
      setOutput({
        status: label,
        runtime,
        stdout: partialStdout,
        error: details || (partialStdout ? '' : label),
      });
    } catch (e) {
      const runtime = Math.round(performance.now() - startedAt);
      const aborted = e.name === 'AbortError';
      setOutput({
        status: aborted ? 'Request Timed Out' : 'Network Error',
        runtime,
        stdout: '',
        error: aborted
          ? `No response after ${REQUEST_TIMEOUT_MS / 1000}s. The function may be cold-starting — try again.`
          : (e.message || 'Failed to reach the code runner.'),
      });
    } finally {
      clearTimeout(timer);
      setIsRunning(false);
    }
  };

  const handleEditorChange = (value) => {
    setCodeByLang((prev) => ({ ...prev, [language.api]: value ?? '' }));
  };

  // Save button: trigger a browser download of the current editor contents
  // using the language-appropriate filename.
  const handleSaveCode = () => {
    const blob = new Blob([code ?? ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = FILENAME[language.api] ?? 'code.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`h-screen flex flex-col font-sans ${theme === 'dark' ? 'bg-[#1e1e1e] text-gray-200' : 'bg-gray-50 text-gray-900'}`}>

      {/* --- Header --- */}
      <header className={`h-14 shrink-0 border-b flex items-center justify-between px-4 z-20 ${theme === 'dark' ? 'bg-[#262626] border-[#333]' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRunCode}
              disabled={isRunning}
              className={`flex items-center space-x-2 px-4 py-2 rounded text-sm font-medium transition-all duration-300 transform active:scale-95 border outline-none focus:ring-2 focus:ring-opacity-50 focus:ring-green-400
                ${isRunning
                  ? theme === 'dark'
                    ? 'bg-[#333] text-gray-500 border-transparent cursor-not-allowed'
                    : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'bg-[#132e21] text-green-400 border-[#1b4d30] hover:bg-[#1a3d2b] hover:border-[#23633e] hover:shadow-sm'
                    : 'bg-green-50 text-green-600 hover:bg-green-100 border-green-200 hover:shadow-sm'
                }`}
            >
              {isRunning ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Play size={16} fill="currentColor" />}
              <span>Run Code</span>
            </button>
            <div className="relative">
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className={`flex items-center space-x-2 px-4 py-2 rounded text-sm border transition-all duration-300 active:scale-95 ${theme === 'dark' ? 'border-[#444] text-gray-300 hover:bg-[#333]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <span>{language.label}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isLangMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isLangMenuOpen && (
                <>
                  {/* Backdrop to close when clicking outside */}
                  <div className="fixed inset-0 z-40" onClick={() => setIsLangMenuOpen(false)}></div>

                  {/* Dropdown Menu */}
                  <div className={`absolute top-full right-0 mt-1 w-40 rounded-md shadow-lg border overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 
                        ${theme === 'dark' ? 'bg-[#1e1e1e] border-[#333] text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}
                  >
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.api}
                        onClick={() => {
                          setLanguage(lang);
                          setIsLangMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between
                                ${theme === 'dark' ? 'hover:bg-[#333]' : 'hover:bg-gray-50'}
                                ${language.api === lang.api ? (theme === 'dark' ? 'bg-[#262626] text-white' : 'bg-gray-50 text-black font-medium') : ''}
                            `}
                      >
                        <span>{lang.label}</span>
                        {language.api === lang.api && <CheckCircle2 size={14} className="opacity-70" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleSaveCode}
            className={`p-2.5 rounded transition-all duration-300 hover:scale-105 active:scale-95 ${theme === 'dark' ? 'bg-[#333] text-gray-400 hover:bg-[#404040]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            title={`Save as ${FILENAME[language.api]}`}
          >
            <Save size={18} />
          </button>

          <button
            className={`p-2.5 rounded transition-all duration-300 hover:scale-105 active:scale-95 ${theme === 'dark' ? 'bg-[#333] text-gray-400 hover:bg-[#404040]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            onClick={() => setIsFullScreen(!isFullScreen)}
            title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
          >
            {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded transition-all duration-300 hover:scale-105 active:scale-95 ${theme === 'dark' ? 'bg-[#333] text-gray-400 hover:bg-[#404040]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">

        {/* Left Panel: Editor */}
        <section
          className={`flex flex-col relative flex-1 min-w-0 ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'}`}
        >
          <div className="flex-1 relative overflow-hidden">
            <Editor
              height="100%"
              language={language.monaco}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              value={code}
              onChange={handleEditorChange}
              loading={
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  Loading Editor...
                </div>
              }
              options={{
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
                fontLigatures: true,
                lineNumbers: 'on',
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                roundedSelection: false,
                readOnly: false,
                cursorStyle: 'line',
                renderLineHighlight: 'all',
                fixedOverflowWidgets: true,
                scrollbar: {
                  vertical: 'hidden',
                  horizontal: 'hidden'
                }
              }}
            />
          </div>
        </section>

        {/* Right Panel: Output & Input */}
        <section
          className={`flex flex-col border-l overflow-hidden
            ${theme === 'dark' ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200'}
            ${isFullScreen ? 'w-0 opacity-0 border-none' : 'w-full md:w-[40%] opacity-100'}`}
        >

          {/* Output Header */}
          <div className={`flex items-center justify-between px-4 py-2 border-b ${theme === 'dark' ? 'border-[#333] bg-[#252526]' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center space-x-2">
              <Terminal size={14} className="text-gray-500" />
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Output</span>
            </div>
            <button
              onClick={() => setOutput(null)}
              className={`text-xs hover:text-gray-500 transition-colors duration-300 ${!output ? 'opacity-0 pointer-events-none' : 'opacity-100 text-gray-400'}`}
            >
              Clear
            </button>
          </div>

          {/* Output Content */}
          <div className={`flex-1 p-4 overflow-auto font-mono text-sm 
                scrollbar-thin 
                ${theme === 'dark'
              ? '[&::-webkit-scrollbar-track]:bg-[#1e1e1e] [&::-webkit-scrollbar-thumb]:bg-[#444] hover:[&::-webkit-scrollbar-thumb]:bg-[#555]'
              : '[&::-webkit-scrollbar-track]:bg-[#f1f1f1] [&::-webkit-scrollbar-thumb]:bg-[#ccc] hover:[&::-webkit-scrollbar-thumb]:bg-[#bbb]'
            }
                [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar]:h-2.5`
          }>
            {isRunning ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
                <div className={`w-8 h-8 border-4 border-t-green-500 rounded-full animate-spin ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'}`}></div>
                <p className="tabular-nums">Running: {elapsed}s…</p>
              </div>
            ) : output ? (
              <div className="space-y-4 animate-in slide-in-from-bottom-2 fade-in duration-500">
                {/* Status Badge — green/amber/red for success/warning/error */}
                {(() => {
                  const kind = getStatusKind(output.status);
                  const tone = kind === 'success'
                    ? 'text-green-500'
                    : kind === 'warning'
                      ? 'text-amber-500'
                      : 'text-red-500';
                  const Icon = kind === 'success'
                    ? CheckCircle2
                    : kind === 'warning'
                      ? AlertTriangle
                      : AlertCircle;
                  return (
                    <div className={`flex items-center space-x-2 ${tone}`}>
                      <Icon size={16} />
                      <span className="font-semibold">{output.status}</span>
                    </div>
                  );
                })()}

                {/* Runtime Info */}
                {output.runtime != null && (
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <Clock size={12} />
                    <span>Finished in {output.runtime} ms</span>
                  </div>
                )}

                {/* Stdout (when present) */}
                {output.stdout && (
                  <div className={`p-3 rounded-md overflow-x-auto ${theme === 'dark' ? 'bg-[#2a2a2a] text-gray-300' : 'bg-gray-100 text-gray-800'}`}>
                    <pre className="whitespace-pre-wrap">{output.stdout}</pre>
                  </div>
                )}

                {/* Error / details */}
                {output.error && (
                  <div className={`p-3 rounded-md overflow-x-auto ${theme === 'dark' ? 'bg-[#3a1a1a] text-red-300 border border-red-900/40' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    <pre className="whitespace-pre-wrap">{output.error}</pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-70 transition-opacity duration-300 hover:opacity-100">
                <div className="flex flex-col items-center min-w-[200px]">
                  <Terminal size={48} strokeWidth={1} className={`mb-2 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`} />
                  <p className="whitespace-nowrap font-medium">Run code to see output</p>
                </div>
              </div>
            )}
          </div>

          {/* Stdin Section */}
          <div className={`flex flex-col ${theme === 'dark' ? 'bg-[#252526]' : 'bg-gray-50'}`}>
            <div
              className="h-8 px-4 text-xs text-gray-500 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:bg-opacity-80 transition-colors"
              onClick={() => setStdinExpanded(!stdinExpanded)}
            >
              <div className="flex items-center space-x-2">
                <span className={`text-gray-400 transform transition-transform duration-300 ${stdinExpanded ? 'rotate-0' : 'rotate-180'}`}>
                  <ChevronDown size={14} />
                </span>
                <span>stdin</span>
              </div>
            </div>
            <div
              className={`overflow-hidden ${stdinExpanded ? 'h-[35vh] opacity-100' : 'h-0 opacity-0'}`}
            >
              <div className={`p-2 h-full ${theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  className={`w-full h-full p-3 text-sm font-mono resize-none focus:outline-none rounded border
                            ${theme === 'dark'
                      ? 'bg-[#1e1e1e] text-gray-300 border-[#333] focus:border-gray-500'
                      : 'bg-white text-gray-800 border-gray-200 focus:border-gray-300'
                    }`}
                  spellCheck="false"
                  placeholder="Enter inputs..."
                />
              </div>
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}