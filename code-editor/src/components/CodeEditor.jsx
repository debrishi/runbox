import Editor from '@monaco-editor/react';

export default function CodeEditor({ language, code, onChange, theme }) {
  return (
    <Editor
      height="100%"
      language={language.monaco}
      theme={theme === 'dark' ? 'vs-dark' : 'light'}
      value={code}
      onChange={(value) => onChange(value ?? '')}
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
          horizontal: 'hidden',
        },
      }}
    />
  );
}
