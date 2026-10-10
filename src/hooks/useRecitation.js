import { useCallback, useEffect, useRef, useState } from 'react';

const SR =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

export const canRecognize = Boolean(SR);

const RECOGNITION_LANG = 'ar-SA';

/**
 * Voice recitation: listens through the browser's speech recognition and exposes the words
 * heard so far. Nothing is recorded or stored — only the live text is kept in memory.
 *  - spoken:   every word heard in this session (finished + still-being-recognised ones)
 *  - stableCount: how many of the first `spoken` words are final (the rest may still change)
 */
export default function useRecitation() {
  const [status, setStatus] = useState('idle'); // idle | listening | stopped
  const [spoken, setSpoken] = useState([]);
  const [stableCount, setStableCount] = useState(0);
  const [error, setError] = useState('');

  const activeRef = useRef(false);
  const recRef = useRef(null);
  const prevFinalRef = useRef([]); // words finalised in earlier recognition sessions
  const sessionFinalRef = useRef([]); // words finalised in the current session
  const lastStartRef = useRef(0);
  const quickEndsRef = useRef(0);

  const fail = useCallback((message) => {
    activeRef.current = false;
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    setError(message);
    setStatus('idle');
  }, []);

  const startRecognition = useCallback(() => {
    const rec = new SR();
    rec.lang = RECOGNITION_LANG;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const finals = [];
      const interim = [];
      for (let i = 0; i < e.results.length; i += 1) {
        const r = e.results[i];
        const words = r[0].transcript.trim().split(/\s+/).filter(Boolean);
        if (r.isFinal) finals.push(...words);
        else interim.push(...words);
      }
      sessionFinalRef.current = finals;
      setSpoken([...prevFinalRef.current, ...finals, ...interim]);
      setStableCount(prevFinalRef.current.length + finals.length);
    };

    rec.onerror = (e) => {
      const code = e.error;
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        fail('تم رفض إذن الميكروفون (أو خدمة التعرف على الكلام غير متاحة). اسمح للموقع باستخدام الميكروفون من إعدادات المتصفح ثم أعد المحاولة.');
      } else if (code === 'audio-capture') {
        fail('لم يتم العثور على ميكروفون يعمل في هذا الجهاز.');
      } else if (code === 'network') {
        fail('التعرف على الكلام يحتاج اتصالًا بالإنترنت.');
      } else {
        fail(`تعذّر التعرف على الكلام (${code}).`);
      }
    };

    rec.onend = () => {
      prevFinalRef.current = [...prevFinalRef.current, ...sessionFinalRef.current];
      sessionFinalRef.current = [];
      setSpoken(prevFinalRef.current);
      setStableCount(prevFinalRef.current.length);
      if (!activeRef.current) return;
      // Browsers end a session after a silence; keep listening, but give up if it keeps dying at once.
      const now = Date.now();
      quickEndsRef.current = now - lastStartRef.current < 700 ? quickEndsRef.current + 1 : 0;
      if (quickEndsRef.current >= 4) {
        fail('توقّف التعرف على الكلام. أعد المحاولة.');
        return;
      }
      lastStartRef.current = now;
      try {
        rec.start();
      } catch {
        /* already started */
      }
    };

    recRef.current = rec;
    lastStartRef.current = Date.now();
    try {
      rec.start();
    } catch {
      fail('تعذّر بدء التعرف على الكلام.');
    }
  }, [fail]);

  const stop = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* not running */
    }
    setStatus('stopped');
  }, []);

  const start = useCallback(() => {
    if (activeRef.current) return;
    setError('');
    setSpoken([]);
    setStableCount(0);
    prevFinalRef.current = [];
    sessionFinalRef.current = [];
    quickEndsRef.current = 0;

    if (!SR) {
      setError('هذا المتصفح لا يدعم التعرف على الكلام. استخدم Google Chrome أو Microsoft Edge.');
      return;
    }
    activeRef.current = true;
    startRecognition();
    setStatus('listening');
  }, [startRecognition]);

  const reset = useCallback(() => {
    stop();
    setSpoken([]);
    setStableCount(0);
    setError('');
    setStatus('idle');
  }, [stop]);

  useEffect(
    () => () => {
      activeRef.current = false;
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { status, spoken, stableCount, error, start, stop, reset };
}
