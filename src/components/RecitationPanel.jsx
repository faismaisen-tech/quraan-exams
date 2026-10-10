import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import useRecitation, { canRecognize } from '../hooks/useRecitation';
import { alignStrict, wordKey } from '../utils/arabicMatch';
import '../recitation.css';

const ALERT_DELAY_MS = 800; // a mistake must still be unresolved after this long before alerting
const ALERT_SHOW_MS = 2200;

// Flattens the answer into words, remembering which verse each one closes.
function buildWords(answerVerses) {
  const words = [];
  answerVerses.forEach((v) => {
    const tokens = v.text.trim().split(/\s+/);
    tokens.forEach((text, i) => {
      words.push({ text, key: wordKey(text), verseNo: v.id, last: i === tokens.length - 1 });
    });
  });
  return words;
}

const MicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

const StopIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export default function RecitationPanel({ answerVerses, onStart }) {
  const { status, spoken, stableCount, error, start, stop, reset } = useRecitation();
  const panelRef = useRef(null);

  const [skipped, setSkipped] = useState([]); // positions the user skipped by hand
  const [alert, setAlert] = useState(null); // { attempts } while the wrong-word warning is showing
  const [alertCount, setAlertCount] = useState(0);

  const words = useMemo(() => buildWords(answerVerses), [answerVerses]);
  const { pointer, states, wrongsAtPointer } = useMemo(
    () => alignStrict(words.map((w) => w.key), spoken, { skipped: new Set(skipped), stableCount }),
    [words, spoken, skipped, stableCount],
  );

  const listening = status === 'listening';
  const stopped = status === 'stopped';
  const complete = pointer >= words.length && words.length > 0;
  const skippedCount = states.filter((s) => s === 'skipped').length;

  // ---- wrong-word alert ----
  // Only a mistake that is STILL unresolved after a short wait counts. If the right word follows
  // (a stray extra word, a recogniser hiccup), `wrongsAtPointer` drops back to 0 and nothing shows.
  const atPointerRef = useRef(0);
  atPointerRef.current = wrongsAtPointer;

  useEffect(() => {
    if (!listening || wrongsAtPointer === 0) return undefined;
    const t = setTimeout(() => {
      if (atPointerRef.current > 0) {
        setAlert({ attempts: atPointerRef.current });
        setAlertCount((c) => c + 1);
      }
    }, ALERT_DELAY_MS);
    return () => clearTimeout(t);
  }, [wrongsAtPointer, listening]);

  // the warning disappears by itself, and as soon as the reader gets the word right
  useEffect(() => {
    if (!alert) return undefined;
    const t = setTimeout(() => setAlert(null), ALERT_SHOW_MS);
    return () => clearTimeout(t);
  }, [alert]);
  useEffect(() => setAlert(null), [pointer]);

  // finished reading the whole answer -> stop listening
  useEffect(() => {
    if (listening && complete) stop();
  }, [listening, complete, stop]);

  // bring the panel into view when a session starts (the floating button can be pressed from anywhere)
  useEffect(() => {
    if (listening) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [listening]);

  const handleToggle = () => {
    if (listening) {
      stop();
      return;
    }
    onStart?.();
    setSkipped([]);
    setAlert(null);
    setAlertCount(0);
    start();
  };

  const skipWord = () => {
    if (pointer < words.length) setSkipped((s) => [...s, pointer]);
  };

  const showPanel = status !== 'idle' || error;

  return (
    <>
      {showPanel && (
        <section className="recite-panel" ref={panelRef} aria-live="polite">
          <div className="recite-head">
            <span className="recite-title">التسميع الصوتي</span>
            {listening && (
              <span className="recite-status recording">
                <span className="rec-dot" aria-hidden="true" />
                جارٍ الاستماع
              </span>
            )}
          </div>

          {error && <div className="error-msg">{error}</div>}

          {!error && (
            <>
              {listening && !alert && (
                <div className="recite-msg recite-hint">اقرأ الآية بصوت واضح، وتظهر الكلمات الصحيحة تباعًا.</div>
              )}
              {listening && alert && (
                <div className="recite-msg recite-alert" role="alert">
                  أعد الكلمة
                  {alert.attempts >= 2 && <span> — أو اضغط «تخطّي الكلمة» إن كان نطقك صحيحًا</span>}
                </div>
              )}
              {complete && stopped && (
                <div className="recite-msg recite-done">
                  ما شاء الله، أتممت الإجابة ✓
                  <span className="recite-stats">
                    {' '}· عدد التنبيهات: {alertCount}
                    {skippedCount > 0 && ` · كلمات تم تخطيها: ${skippedCount}`}
                  </span>
                </div>
              )}
              {stopped && !complete && (
                <div className="recite-msg recite-hint">
                  توقّف التسميع عند الكلمة {pointer + 1} من {words.length}. يمكنك إعادة المحاولة أو الضغط على «إظهار الإجابة».
                </div>
              )}

              <div className="recite-answer">
                {words.map((w, idx) => {
                  const st = states[idx];
                  const isNext = idx === pointer && !complete;
                  return (
                    <Fragment key={idx}>
                      {st === 'pending' ? (
                        <span
                          className={`rw rw-pending${isNext && listening ? ' rw-next' : ''}${isNext && alert ? ' rw-alert' : ''}`}
                          style={{ width: `${Math.max(1.2, w.key.length * 0.55)}em` }}
                          aria-hidden="true"
                        />
                      ) : (
                        <span className={`rw rw-${st}`}>{w.text}</span>
                      )}
                      {w.last && st !== 'pending' && <span className="rw-verse">﴿{w.verseNo}﴾</span>}{' '}
                    </Fragment>
                  );
                })}
              </div>

              <div className="recite-actions">
                {listening && (
                  <button className="btn-secondary" onClick={skipWord} disabled={complete}>
                    تخطّي الكلمة
                  </button>
                )}
                {stopped && (
                  <>
                    <button className="btn-secondary" onClick={handleToggle}>إعادة المحاولة</button>
                    <button className="btn-secondary" onClick={reset}>إغلاق</button>
                  </>
                )}
              </div>

              <p className="recite-disclaimer">
                يتحقق من الكلمات فقط؛ لا يفحص التشكيل ولا أحكام التجويد، والتعرف الآلي قد يخطئ أحيانًا.
              </p>
            </>
          )}
        </section>
      )}

      <button
        className={`fab-recite ${listening ? 'listening' : ''}`}
        onClick={handleToggle}
        aria-label={listening ? 'إيقاف التسميع' : 'بدء التسميع الصوتي'}
        title={canRecognize ? undefined : 'التعرف على الكلام يعمل على Chrome وEdge'}
      >
        {listening ? <StopIcon /> : <MicIcon />}
        <span>{listening ? 'إيقاف' : 'تسميع'}</span>
      </button>
    </>
  );
}
