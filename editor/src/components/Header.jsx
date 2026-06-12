import { Play, Moon, Sun, Save, Maximize2, Minimize2 } from 'lucide-react';
import LanguageDropdown from './LanguageDropdown';
import { EXTENSION } from '../constants';

export default function Header({
  language,
  onLanguageChange,
  onRun,
  isRunning,
  onSave,
  isFullScreen,
  onFullScreenToggle,
  theme,
  onThemeToggle,
}) {
  return (
    <header className={`h-14 shrink-0 border-b flex items-center justify-between px-4 z-20 ${theme === 'dark' ? 'bg-[#262626] border-[#333]' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={onRun}
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
            {isRunning
              ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : <Play size={16} fill="currentColor" />}
            <span>Run Code</span>
          </button>
          <LanguageDropdown language={language} onChange={onLanguageChange} theme={theme} />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onSave}
          className={`p-2.5 rounded transition-all duration-300 hover:scale-105 active:scale-95 ${theme === 'dark' ? 'bg-[#333] text-gray-400 hover:bg-[#404040]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          title={`Save as .${EXTENSION[language.api]}`}
        >
          <Save size={18} />
        </button>

        <button
          className={`p-2.5 rounded transition-all duration-300 hover:scale-105 active:scale-95 ${theme === 'dark' ? 'bg-[#333] text-gray-400 hover:bg-[#404040]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          onClick={onFullScreenToggle}
          title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
        >
          {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>

        <button
          onClick={onThemeToggle}
          className={`p-2.5 rounded transition-all duration-300 hover:scale-105 active:scale-95 ${theme === 'dark' ? 'bg-[#333] text-gray-400 hover:bg-[#404040]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
