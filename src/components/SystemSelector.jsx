import { useState } from 'react';
import { SYSTEMS, SYSTEM_BY_KEY } from '../data/systems';
import { getSurahName, isUnitUsable } from '../utils/mushaf';

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export default function SystemSelector({ system, onSystemChange, selected, onChange }) {
  const sys = SYSTEM_BY_KEY[system];
  const all = range(1, sys.count).filter((n) => isUnitUsable(system, n));
  const showRange = sys.count > 30;

  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  const toggle = (n) => {
    if (selected.includes(n)) onChange(selected.filter((x) => x !== n));
    else onChange([...selected, n].sort((a, b) => a - b));
  };

  const addRange = () => {
    const from = Math.max(1, Math.min(Number(rangeFrom), sys.count));
    const to = Math.max(1, Math.min(Number(rangeTo || rangeFrom), sys.count));
    if (!from) return;
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    const merged = new Set([...selected, ...range(lo, hi).filter((n) => isUnitUsable(system, n))]);
    onChange([...merged].sort((a, b) => a - b));
    setRangeFrom('');
    setRangeTo('');
  };

  return (
    <div className="selector">
      <div className="system-tabs" role="tablist" aria-label="نظام تحديد السؤال">
        {SYSTEMS.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={s.key === system}
            className={`system-tab ${s.key === system ? 'active' : ''}`}
            onClick={() => onSystemChange(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="selector-header">
        <span className="label">
          اختر {sys.label}:
          <span className="selected-count">المحدد: {selected.length}</span>
        </span>
        <div className="selector-actions">
          <button className="btn-secondary" onClick={() => onChange(all)}>الكل</button>
          <button className="btn-secondary" onClick={() => onChange([])}>إلغاء</button>
        </div>
      </div>

      <p className="selector-hint">{sys.hint}</p>

      {showRange && (
        <div className="range-row">
          <span>من</span>
          <input
            type="number" min="1" max={sys.count} inputMode="numeric"
            value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)}
            aria-label={`من ${sys.label}`}
          />
          <span>إلى</span>
          <input
            type="number" min="1" max={sys.count} inputMode="numeric"
            value={rangeTo} onChange={(e) => setRangeTo(e.target.value)}
            aria-label={`إلى ${sys.label}`}
          />
          <button className="btn-secondary" onClick={addRange} disabled={!rangeFrom}>
            إضافة المدى
          </button>
        </div>
      )}

      <div className={`unit-grid unit-grid-${system}`}>
        {range(1, sys.count).map((n) => {
          const usable = isUnitUsable(system, n);
          return (
            <button
              key={n}
              disabled={!usable}
              title={usable ? undefined : 'لا يحتوي على 3 آيات على الأقل'}
              className={`unit-btn ${selected.includes(n) ? 'selected' : ''}`}
              onClick={() => toggle(n)}
            >
              {system === 'surah' ? (
                <>
                  <span className="unit-num">{n}</span>
                  <span className="unit-name">{getSurahName(n)}</span>
                </>
              ) : (
                n
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
