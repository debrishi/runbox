import { useState } from 'react';
import { STARTER_CODE } from './starterCode';
import { LANGUAGES, EXTENSION, DEFAULT_BASENAME } from './constants';
import { useTheme } from './hooks/useTheme';
import { useCodeRunner } from './hooks/useCodeRunner';
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';
import OutputPanel from './components/OutputPanel';
import StdinPanel from './components/StdinPanel';
import SaveModal from './components/SaveModal';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { output, setOutput, isRunning, elapsed, runCode } = useCodeRunner();

  // Code is per-language so switching languages doesn't blow away your work.
  const [codeByLang, setCodeByLang] = useState(STARTER_CODE);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const code = codeByLang[language.api];

  const [stdin, setStdin] = useState('Developer');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Save modal state.
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveBasename, setSaveBasename] = useState('');

  const handleRunCode = () => {
    if (isFullScreen) setIsFullScreen(false);
    runCode(language.api, code, stdin);
  };

  const handleEditorChange = (value) => {
    setCodeByLang((prev) => ({ ...prev, [language.api]: value }));
  };

  const openSaveModal = () => {
    setSaveBasename(DEFAULT_BASENAME[language.api] ?? 'code');
    setSaveModalOpen(true);
  };

  const performSave = () => {
    const name = saveBasename.trim();
    if (!name) return;
    const ext = EXTENSION[language.api] ?? 'txt';
    const filename = `${name}.${ext}`;
    const blob = new Blob([code ?? ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setSaveModalOpen(false);
  };

  return (
    <div className={`h-screen flex flex-col font-sans ${theme === 'dark' ? 'bg-[#1e1e1e] text-gray-200' : 'bg-gray-50 text-gray-900'}`}>

      <Header
        language={language}
        onLanguageChange={setLanguage}
        onRun={handleRunCode}
        isRunning={isRunning}
        onSave={openSaveModal}
        isFullScreen={isFullScreen}
        onFullScreenToggle={() => setIsFullScreen(!isFullScreen)}
        theme={theme}
        onThemeToggle={toggleTheme}
      />

      <main className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">

        {/* Left Panel: Editor */}
        <section className={`flex flex-col relative flex-1 min-w-0 ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'}`}>
          <div className="flex-1 relative overflow-hidden">
            <CodeEditor
              language={language}
              code={code}
              onChange={handleEditorChange}
              theme={theme}
            />
          </div>
        </section>

        {/* Right Panel: Output & Input */}
        <section
          className={`flex flex-col border-l overflow-hidden
            ${theme === 'dark' ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-gray-200'}
            ${isFullScreen ? 'w-0 opacity-0 border-none' : 'w-full md:w-[40%] opacity-100'}`}
        >
          <OutputPanel
            output={output}
            isRunning={isRunning}
            elapsed={elapsed}
            onClear={() => setOutput(null)}
            theme={theme}
          />
          <StdinPanel stdin={stdin} onChange={setStdin} theme={theme} />
        </section>
      </main>

      <SaveModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        basename={saveBasename}
        onBasenameChange={setSaveBasename}
        onSave={performSave}
        language={language}
        theme={theme}
      />
    </div>
  );
}