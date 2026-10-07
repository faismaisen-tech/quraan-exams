import quranData from 'quran-json/dist/quran.json';
import { RUB_STARTS, PAGE_STARTS } from '../data/mushafIndex';
import { SYSTEMS } from '../data/systems';

const countWords = (text) => text.trim().split(/\s+/).length;

// ---------------------------------------------------------------------------
// One entry per ayah (6236), in mushaf order, carrying every division it belongs to.
// juz / hizb / rub / page come from the exact start-of-rub' and start-of-page tables.
// ---------------------------------------------------------------------------
export const AYAHS = [];
{
  let gid = 0;
  let rub = 0;
  let page = 0;
  for (const surah of quranData) {
    for (const v of surah.verses) {
      gid += 1;
      while (rub < RUB_STARTS.length && RUB_STARTS[rub] <= gid) rub += 1;
      while (page < PAGE_STARTS.length && PAGE_STARTS[page] <= gid) page += 1;
      const hizb = Math.ceil(rub / 4);
      AYAHS.push({
        gid,
        surahId: surah.id,
        surahName: surah.name,
        id: v.id, // ayah number inside its surah
        text: v.text,
        words: countWords(v.text),
        rub,
        hizb,
        juz: Math.ceil(hizb / 2),
        page,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Index: system -> unit number -> ayahs of that unit (mushaf order)
// ---------------------------------------------------------------------------
const UNIT_INDEX = {};
for (const sys of SYSTEMS) {
  const map = new Map();
  for (let n = 1; n <= sys.count; n += 1) map.set(n, []);
  for (const a of AYAHS) map.get(a[sys.field]).push(a);
  UNIT_INDEX[sys.key] = map;
}

export const getUnitAyahs = (system, unit) => UNIT_INDEX[system]?.get(unit) ?? [];
export const getSurahName = (id) => quranData[id - 1]?.name ?? '';

// ---------------------------------------------------------------------------
// Question rules
// ---------------------------------------------------------------------------
export const MIN_WORDS = 75;   // preferred length of the covered passage (start..end)
export const MAX_WORDS = 170;
const MIN_VERSES = 3;          // start + at least one hidden verse + end

// A unit can host a question only if it holds at least MIN_VERSES ayahs.
export const isUnitUsable = (system, unit) => getUnitAyahs(system, unit).length >= MIN_VERSES;

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Splits a unit's ayahs into runs that stay inside one surah.
function splitBySurah(ayahs) {
  const runs = [];
  for (const a of ayahs) {
    const last = runs[runs.length - 1];
    if (last && last[0].surahId === a.surahId) last.push(a);
    else runs.push([a]);
  }
  return runs;
}

// Finds [i, j] inside `run` where verses i..j are whole ayahs, j >= i + 2, and the
// total word count lies in [minWords, maxWords]. Returns null if none exists.
function pickWindow(run, minWords, maxWords, shortest) {
  if (run.length < MIN_VERSES) return null;
  const starts = shuffle([...Array(run.length - MIN_VERSES + 1).keys()]);
  for (const i of starts) {
    let total = run[i].words;
    const ends = [];
    for (let j = i + 1; j < run.length; j += 1) {
      total += run[j].words;
      if (total > maxWords) break;
      if (j - i + 1 >= MIN_VERSES && total >= minWords) ends.push(j);
    }
    if (ends.length) return [i, shortest ? ends[0] : pickRandom(ends)];
  }
  return null;
}

// Progressively relaxed length rules, so small units (a page, a short surah) still work.
function lengthTiers(run) {
  const totalWords = run.reduce((n, a) => n + a.words, 0);
  return [
    { min: MIN_WORDS, max: MAX_WORDS },
    { min: Math.min(MIN_WORDS, Math.floor(totalWords / 2)), max: MAX_WORDS },
    { min: 0, max: MAX_WORDS },
    { min: 0, max: Infinity, shortest: true }, // last resort: exactly 3 ayahs
  ];
}

function findInRuns(runs) {
  const tierCount = 4;
  for (let t = 0; t < tierCount; t += 1) {
    for (const run of shuffle(runs)) {
      const tier = lengthTiers(run)[t];
      const win = pickWindow(run, tier.min, tier.max, tier.shortest);
      if (win) return { run, window: win };
    }
  }
  return null;
}

// Where the answer sits: ranges for juz / hizb / rub / page, and the surah(s) covered.
function buildLocation(answer) {
  const first = answer[0];
  const last = answer[answer.length - 1];
  const surahs = [];
  for (const a of answer) {
    const s = surahs[surahs.length - 1];
    if (s && s.id === a.surahId) s.to = a.id;
    else surahs.push({ id: a.surahId, name: a.surahName, from: a.id, to: a.id });
  }
  return {
    surahs,
    juz: [first.juz, last.juz],
    hizb: [first.hizb, last.hizb],
    rub: [first.rub, last.rub],
    page: [first.page, last.page],
  };
}

function questionFromUnit(system, unit) {
  const ayahs = getUnitAyahs(system, unit);
  if (ayahs.length < MIN_VERSES) return null;

  // 1) Prefer a question that stays inside a single surah (as in a normal exam).
  let found = findInRuns(splitBySurah(ayahs));
  let answer;
  if (found) {
    const [i, j] = found.window;
    answer = found.run.slice(i, j + 1);
  } else {
    // 2) Rare: the unit is cut into pieces too small for that -> run across the surah border.
    found = findInRuns([ayahs]);
    if (!found) return null;
    const [i, j] = found.window;
    answer = ayahs.slice(i, j + 1);
  }

  return {
    system,
    unit,
    verseStart: answer[0],
    verseEnd: answer[answer.length - 1],
    answerVerses: answer,
    location: buildLocation(answer),
  };
}

// Main entry: `selectedUnits` are numbers of the chosen system (e.g. system 'rub', [17, 18]).
// The question is always taken entirely from ONE randomly chosen unit among them.
export function generateQuestion(system, selectedUnits) {
  const candidates = shuffle(selectedUnits.filter((u) => isUnitUsable(system, u)));
  for (const unit of candidates) {
    const q = questionFromUnit(system, unit);
    if (q) return q;
  }
  return null;
}
