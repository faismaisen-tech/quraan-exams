import { useState } from 'react';
import { SYSTEM_BY_KEY } from '../data/systems';

const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع'];
const span = ([a, b]) => (a === b ? `${a}` : `${a}–${b}`);

// Builds the "where is this question" chips. The chip of the system the question was
// drawn from is highlighted.
function buildChips(question) {
  const { location, system } = question;
  const chips = [];

  location.surahs.forEach((s) => {
    chips.push({
      key: `surah-${s.id}`,
      active: system === 'surah',
      text: `سورة ${s.name} (${s.from === s.to ? `الآية ${s.from}` : `الآيات ${s.from}–${s.to}`})`,
    });
  });

  chips.push({ key: 'juz', active: system === 'juz', text: `الجزء ${span(location.juz)}` });
  chips.push({ key: 'hizb', active: system === 'hizb', text: `الحزب ${span(location.hizb)}` });

  const [r1, r2] = location.rub;
  const rubText =
    r1 === r2
      ? `الربع ${r1} (${ORDINALS[(r1 - 1) % 4]} من الحزب ${location.hizb[0]})`
      : `الأرباع ${r1}–${r2}`;
  chips.push({ key: 'rub', active: system === 'rub', text: rubText });

  const [p1, p2] = location.page;
  chips.push({
    key: 'page',
    active: system === 'page',
    text: p1 === p2 ? `الوجه ${p1}` : `الوجهان ${p1}–${p2}`,
  });

  return chips;
}

export default function QuestionCard({ question }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [showMeta, setShowMeta] = useState(false);

  if (!question) return null;

  const { verseStart, verseEnd, answerVerses, system, unit } = question;
  const crossSurah = question.location.surahs.length > 1;

  return (
    <div className="question-card">
      <div className="question-meta-row">
        <label className="meta-toggle">
          <input
            type="checkbox"
            checked={showMeta}
            onChange={(e) => setShowMeta(e.target.checked)}
          />
          إظهار موضع السؤال (السورة والجزء والحزب والربع والوجه)
        </label>
        {showMeta && (
          <>
            <div className="question-source">
              السؤال من {SYSTEM_BY_KEY[system].label} رقم {unit}
            </div>
            <div className="question-meta">
              {buildChips(question).map((c) => (
                <span key={c.key} className={c.active ? 'chip-active' : ''}>{c.text}</span>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="question-text">
        أكمل من قوله تعالى:{' '}
        <span className="verse-highlight">﴿{verseStart.text}﴾</span>
        {' '}إلى{' '}
        <span className="verse-highlight">﴿{verseEnd.text}﴾</span>
      </p>

      <button
        className="btn-show-answer"
        onClick={() => setShowAnswer((v) => !v)}
      >
        {showAnswer ? 'إخفاء الإجابة' : 'إظهار الإجابة'}
      </button>

      {showAnswer && (
        <div className="answer-block">
          <div className="answer-label">الإجابة:</div>
          <div className="answer-verses">
            {answerVerses.map((v, i) => (
              <div key={v.gid}>
                {crossSurah && (i === 0 || answerVerses[i - 1].surahId !== v.surahId) && (
                  <div className="answer-surah">سورة {v.surahName}</div>
                )}
                <div className="answer-verse">
                  <span className="verse-num">{v.id}</span>
                  <span className="verse-text">{v.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
