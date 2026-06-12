import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function StdinPanel({ stdin, onChange, theme }) {
  // stdin starts expanded so first-time users notice the input field —
  // the Python and TypeScript starters read from stdin, so a collapsed
  // panel with a magic 'Developer' default looks like the starter is
  // ignoring input until you discover the chevron.
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`flex flex-col ${theme === 'dark' ? 'bg-[#252526]' : 'bg-gray-50'}`}>
      <div
        className="h-8 px-4 text-xs text-gray-500 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:bg-opacity-80 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-2">
          <span className={`text-gray-400 transform transition-transform duration-300 ${expanded ? 'rotate-0' : 'rotate-180'}`}>
            <ChevronDown size={14} />
          </span>
          <span>stdin</span>
        </div>
      </div>
      <div
        className={`overflow-hidden ${expanded ? 'h-[35vh] opacity-100' : 'h-0 opacity-0'}`}
      >
        <div className={`p-2 h-full ${theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
          <textarea
            value={stdin}
            onChange={(e) => onChange(e.target.value)}
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
  );
}
