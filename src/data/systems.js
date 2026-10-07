// The five ways a question can be scoped. `field` is the property on each ayah entry
// (see utils/mushaf.js) that holds the unit number for that system.
export const SYSTEMS = [
  { key: 'juz',   field: 'juz',     label: 'الجزء',  count: 30,  hint: '30 جزءًا' },
  { key: 'surah', field: 'surahId', label: 'السورة', count: 114, hint: '114 سورة' },
  { key: 'hizb',  field: 'hizb',    label: 'الحزب',  count: 60,  hint: '60 حزبًا (كل جزء = حزبان)' },
  { key: 'rub',   field: 'rub',     label: 'الربع',  count: 240, hint: '240 ربعًا، مرقّمة من 1 إلى 240 (كل حزب = 4 أرباع)' },
  { key: 'page',  field: 'page',    label: 'الوجه',  count: 604, hint: '604 وجه، بترقيم مصحف المدينة (رواية حفص)' },
];

export const SYSTEM_BY_KEY = Object.fromEntries(SYSTEMS.map((s) => [s.key, s]));
