import { useEffect, useRef } from 'react';
import { EXTENSION } from '../constants';

export default function SaveModal({
  isOpen,
  onClose,
  basename,
  onBasenameChange,
  onSave,
  language,
  theme,
}) {
  const inputRef = useRef(null);

  // Auto-focus + select the basename when the modal opens, so the user can
  // immediately type to replace the default.
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const ext = EXTENSION[language.api] ?? 'txt';
  const isValid = basename.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-[90%] max-w-md rounded-lg shadow-xl p-5 space-y-4 ${theme === 'dark' ? 'bg-[#262626] border border-[#333] text-gray-200' : 'bg-white border border-gray-200 text-gray-900'}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave();
          if (e.key === 'Escape') onClose();
        }}
      >
        <h2 className="text-base font-semibold">Save file</h2>
        <div
          className={`flex items-stretch rounded border overflow-hidden font-mono text-sm ${theme === 'dark' ? 'bg-[#1e1e1e] border-[#444]' : 'bg-gray-50 border-gray-300'}`}
        >
          <input
            ref={inputRef}
            type="text"
            value={basename}
            onChange={(e) => onBasenameChange(e.target.value)}
            placeholder="filename"
            className="flex-1 min-w-0 bg-transparent px-3 py-2 outline-none"
          />
          <span
            className={`px-3 py-2 select-none ${theme === 'dark' ? 'bg-[#333] text-gray-400 border-l border-[#444]' : 'bg-gray-100 text-gray-500 border-l border-gray-300'}`}
          >
            .{ext}
          </span>
        </div>
        <div className="flex justify-end space-x-2 pt-1">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded text-sm transition-all duration-200 active:scale-95 ${theme === 'dark' ? 'border border-[#444] text-gray-300 hover:bg-[#333]' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!isValid}
            className={`px-4 py-2 rounded text-sm font-medium transition-all duration-300 transform active:scale-95 border outline-none focus:ring-2 focus:ring-opacity-50 focus:ring-green-400
              ${
                !isValid
                  ? theme === 'dark'
                    ? 'bg-[#333] text-gray-500 border-transparent cursor-not-allowed'
                    : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'bg-[#132e21] text-green-400 border-[#1b4d30] hover:bg-[#1a3d2b] hover:border-[#23633e] hover:shadow-sm'
                    : 'bg-green-50 text-green-600 hover:bg-green-100 border-green-200 hover:shadow-sm'
              }`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
