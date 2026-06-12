import { useState } from 'react';
import { ChevronDown, CheckCircle2 } from 'lucide-react';
import { LANGUAGES } from '../constants';

export default function LanguageDropdown({ language, onChange, theme }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-4 py-2 rounded text-sm border transition-all duration-300 active:scale-95 ${theme === 'dark' ? 'border-[#444] text-gray-300 hover:bg-[#333]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
      >
        <span>{language.label}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close when clicking outside */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>

          {/* Dropdown Menu */}
          <div className={`absolute top-full right-0 mt-1 w-40 rounded-md shadow-lg border overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 
                ${theme === 'dark' ? 'bg-[#1e1e1e] border-[#333] text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}
          >
            {LANGUAGES.map((lang) => (
              <button
                key={lang.api}
                onClick={() => {
                  onChange(lang);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between
                        ${theme === 'dark' ? 'hover:bg-[#333]' : 'hover:bg-gray-50'}
                        ${language.api === lang.api ? (theme === 'dark' ? 'bg-[#262626] text-white' : 'bg-gray-50 text-black font-medium') : ''}`}
              >
                <span>{lang.label}</span>
                {language.api === lang.api && <CheckCircle2 size={14} className="opacity-70" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
