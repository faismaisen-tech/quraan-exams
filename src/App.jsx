import { useState } from 'react';
import SystemSelector from './components/SystemSelector';
import QuestionCard from './components/QuestionCard';
import { SYSTEM_BY_KEY } from './data/systems';
import { generateQuestion } from './utils/mushaf';

const EMPTY_SELECTION = { juz: [], surah: [], hizb: [], rub: [], page: [] };

export default function App() {
  const [system, setSystem] = useState('juz');
  // Each system keeps its own selection, so switching tabs doesn't lose it.
  const [selections, setSelections] = useState(EMPTY_SELECTION);
  const [question, setQuestion] = useState(null);
  const [questionNo, setQuestionNo] = useState(0);
  const [error, setError] = useState('');

  const selected = selections[system];
  const setSelected = (units) => setSelections((prev) => ({ ...prev, [system]: units }));

  const changeSystem = (key) => {
    setSystem(key);
    setQuestion(null);
    setError('');
  };

  const handleGenerate = () => {
    setError('');
    setQuestion(null);

    if (!selected.length) {
      setError(`الرجاء اختيار ${SYSTEM_BY_KEY[system].label} واحد على الأقل`);
      return;
    }

    const q = generateQuestion(system, selected);
    if (!q) {
      setError('تعذّر توليد سؤال من هذا الاختيار (يلزم 3 آيات على الأقل). اختر وحدة أكبر.');
      return;
    }
    setQuestion(q);
    setQuestionNo((n) => n + 1);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>امتحانات القرآن الكريم</h1>
      </header>

      <main className="app-main">
        <SystemSelector
          system={system}
          onSystemChange={changeSystem}
          selected={selected}
          onChange={setSelected}
        />

        <button
          className="btn-generate"
          onClick={handleGenerate}
          disabled={!selected.length}
        >
          توليد السؤال
        </button>

        {error && <div className="error-msg">{error}</div>}

        {/* Key forces remount so the answer/meta toggles reset on every new question */}
        {question && <QuestionCard key={questionNo} question={question} />}
      </main>
    </div>
  );
}
