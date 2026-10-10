// Matching a recited (speech-recognised) text against the exact Quran text.
// Speech recognition returns UNVOWELLED, modern-spelling Arabic, while the Quran text is
// fully vowelled Uthmani script. So both sides are reduced to a "skeleton" before comparing.

// harakat, Quranic annotation marks, dagger alef, tatweel, bidi marks
const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u0640\u200C\u200D\u200E\u200F]/g;

export function normalizeArabic(s) {
  return s
    .replace(MARKS, '')
    .replace(/[\u0671\u0622\u0623\u0625]/g, '\u0627') // ٱ آ أ إ -> ا
    .replace(/\u0649/g, '\u064A') // ى -> ي
    .replace(/\u0629/g, '\u0647') // ة -> ه
    .replace(/\u0624/g, '\u0648') // ؤ -> و
    .replace(/\u0626/g, '\u064A') // ئ -> ي
    .replace(/[^\u0621-\u064A]/g, ''); // keep letters only (drops digits, latin, punctuation)
}

// Alef is spelled differently in Uthmani vs modern text (العالمين / ٱلۡعَٰلَمِينَ, ذلك / ذَٰلِكَ),
// so alefs are dropped from the comparison key.
export function wordKey(word) {
  const n = normalizeArabic(word);
  const k = n.replace(/[\u0627\u0621]/g, ''); // alef and bare hamza are spelled differently by recognisers
  return k || n;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// 1 = identical, 0 = nothing in common
export function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/**
 * STRICT, in-order matching for voice recitation.
 *
 * Only the NEXT expected word can be accepted. If the reciter says something else it is a
 * "wrong" word: nothing is revealed and the pointer stays where it is until the right word
 * is heard. Also copes with the recogniser merging two words into one or splitting one in two.
 *
 *  - skipped:     expected positions the user chose to skip by hand (accepted without speech)
 *  - stableCount: how many of the first spoken words are FINAL. Words after that are still being
 *                 recognised and may change, so they can reveal a word when they match, but a
 *                 non-matching one is simply ignored — it is never counted as a mistake.
 *
 * Recomputed from scratch each time, so changing interim results are fine.
 * Returns { pointer, states, wrongs, wrongsAtPointer, lastWrong } where
 * wrongsAtPointer / lastWrong describe mistakes made since the last accepted word.
 */
export function alignStrict(
  expectedKeys,
  spokenWords,
  { skipped = new Set(), stableCount = Infinity, threshold = 0.75 } = {},
) {
  const entries = spokenWords
    .map((raw, idx) => ({ raw, key: wordKey(raw), stable: idx < stableCount }))
    .filter((e) => e.key);
  const n = expectedKeys.length;
  const states = new Array(n).fill('pending');
  let p = 0;
  let wrongs = 0;
  let wrongsAtPointer = 0;
  let lastWrong = '';
  let i = 0;

  const advanceSkipped = () => {
    while (p < n && skipped.has(p)) {
      states[p] = 'skipped';
      p += 1;
      wrongsAtPointer = 0;
      lastWrong = '';
    }
  };
  advanceSkipped();

  while (i < entries.length && p < n) {
    const e = entries[i];
    const w = e.key;
    const target = expectedKeys[p];
    let best = { score: similarity(w, target), eat: 1, span: 1 };

    // recogniser glued two Quran words together
    if (w.length >= 3 && p + 1 < n && !skipped.has(p + 1)) {
      const s = similarity(w, target + expectedKeys[p + 1]) - 0.05;
      if (s > best.score) best = { score: s, eat: 1, span: 2 };
    }
    // recogniser split one Quran word into two
    if (i + 1 < entries.length) {
      const s = similarity(w + entries[i + 1].key, target) - 0.05;
      if (s > best.score) best = { score: s, eat: 2, span: 1 };
    }

    if (best.score >= threshold) {
      for (let q = p; q < p + best.span; q += 1) states[q] = 'correct';
      p += best.span;
      i += best.eat;
      wrongsAtPointer = 0;
      lastWrong = '';
      advanceSkipped();
    } else {
      // Judged wrong only if it is a FINAL word; single letters are recogniser noise.
      if (e.stable && w.length >= 2) {
        wrongs += 1;
        wrongsAtPointer += 1;
        lastWrong = e.raw;
      }
      i += 1;
    }
  }

  return { pointer: p, states, wrongs, wrongsAtPointer, lastWrong };
}
