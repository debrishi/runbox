import {
  Terminal,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { getStatusKind } from '../constants';

// --- Status badge (internal) -------------------------------------------

function StatusBadge({ output }) {
  const kind = getStatusKind(output.status);
  const tone =
    kind === 'success'
      ? 'text-green-500'
      : kind === 'warning'
        ? 'text-amber-500'
        : 'text-red-500';
  const Icon =
    kind === 'success'
      ? CheckCircle2
      : kind === 'warning'
        ? AlertTriangle
        : AlertCircle;

  return (
    <div className={`flex items-center space-x-2 ${tone}`}>
      <Icon size={16} />
      <span className="font-semibold">{output.status}</span>
      {output.runMs != null && (
        <span className="text-xs font-normal text-gray-500 tabular-nums">
          in {output.runMs} ms
        </span>
      )}
    </div>
  );
}

// --- OutputPanel --------------------------------------------------------

export default function OutputPanel({
  output,
  isRunning,
  elapsed,
  onClear,
  theme,
}) {
  return (
    <>
      {/* Output Header */}
      <div
        className={`flex items-center justify-between px-4 py-2 border-b ${theme === 'dark' ? 'border-[#333] bg-[#252526]' : 'border-gray-200 bg-gray-50'}`}
      >
        <div className="flex items-center space-x-2">
          <Terminal size={14} className="text-gray-500" />
          <span
            className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
          >
            Output
          </span>
        </div>
        <button
          onClick={onClear}
          className={`text-xs hover:text-gray-500 transition-colors duration-300 ${!output ? 'opacity-0 pointer-events-none' : 'opacity-100 text-gray-400'}`}
        >
          Clear
        </button>
      </div>

      {/* Output Content */}
      <div
        className={`flex-1 p-4 overflow-auto font-mono text-sm 
            scrollbar-thin 
            ${
              theme === 'dark'
                ? '[&::-webkit-scrollbar-track]:bg-[#1e1e1e] [&::-webkit-scrollbar-thumb]:bg-[#444] hover:[&::-webkit-scrollbar-thumb]:bg-[#555]'
                : '[&::-webkit-scrollbar-track]:bg-[#f1f1f1] [&::-webkit-scrollbar-thumb]:bg-[#ccc] hover:[&::-webkit-scrollbar-thumb]:bg-[#bbb]'
            }
            [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar]:h-2.5`}
      >
        {isRunning ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
            <div
              className={`w-8 h-8 border-4 border-t-green-500 rounded-full animate-spin ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'}`}
            ></div>
            <p className="tabular-nums">Running: {elapsed}s…</p>
          </div>
        ) : output ? (
          <div className="space-y-4 animate-in slide-in-from-bottom-2 fade-in duration-500">
            <StatusBadge output={output} />

            {/* Stdout (when present) */}
            {output.stdout && (
              <div
                className={`p-3 rounded-md ${theme === 'dark' ? 'bg-[#2a2a2a] text-gray-300' : 'bg-gray-100 text-gray-800'}`}
              >
                <pre className="whitespace-pre-wrap break-all">
                  {output.stdout}
                </pre>
              </div>
            )}

            {/* Error / details */}
            {output.error && (
              <div
                className={`p-3 rounded-md ${theme === 'dark' ? 'bg-[#3a1a1a] text-red-300 border border-red-900/40' : 'bg-red-50 text-red-700 border border-red-100'}`}
              >
                <pre className="whitespace-pre-wrap break-all">
                  {output.error}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-70 transition-opacity duration-300 hover:opacity-100">
            <div className="flex flex-col items-center min-w-[200px]">
              <Terminal
                size={48}
                strokeWidth={1}
                className={`mb-2 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`}
              />
              <p className="whitespace-nowrap font-medium">
                Run code to see output
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
