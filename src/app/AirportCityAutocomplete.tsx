import { useState, useRef, useEffect, useCallback } from 'react';
import type { AirportOption } from './airports';
import { searchAirports, POPULAR_AIRPORTS } from './airports';

interface Props {
  value: AirportOption | null;
  onChange: (v: AirportOption | null) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export type { AirportOption };

export default function AirportCityAutocomplete({ value, onChange, placeholder = 'City or airport…', label, className }: Props) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<AirportOption[]>([]);
  const [open, setOpen]             = useState(false);
  const [highlighted, setHi]       = useState(0);
  const inputRef                    = useRef<HTMLInputElement>(null);
  const listRef                     = useRef<HTMLDivElement>(null);
  const skipBlur                    = useRef(false);

  // Displayed text: selected city (IATA) or raw query
  const displayText = value ? `${value.city} (${value.iata})` : query;

  // Run search whenever query changes
  useEffect(() => {
    if (query.length < 2) {
      setResults(POPULAR_AIRPORTS);
      return;
    }
    // Synchronous – well under 100 ms for ~130 airports
    setResults(searchAirports(query));
    setHi(0);
  }, [query]);

  const select = useCallback((apt: AirportOption) => {
    onChange(apt);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }, [onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (value) onChange(null);       // clear stale selection on new keypress
    setQuery(e.target.value);
    setOpen(true);
  };

  const handleFocus = () => {
    setOpen(true);
    if (value) {
      // Select all so user can immediately retype
      setTimeout(() => inputRef.current?.select(), 0);
    }
  };

  const handleBlur = () => {
    if (skipBlur.current) { skipBlur.current = false; return; }
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); if (results[highlighted]) select(results[highlighted]); }
    if (e.key === 'Escape')    { setOpen(false); setQuery(''); onChange(null); }
  };

  // Scroll highlighted row into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  const showList = open && results.length > 0;

  return (
    <div className={`relative ${className ?? ''}`}>
      {label && (
        <label className="ds-label">{label}</label>
      )}

      {/* Input wrapper */}
      <div className="relative">
        {/* Plane icon */}
        <span className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-gray-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
            <path d="M21 16l-5.5-1.5L12 5 8.5 14.5 3 16l4.5 2.5L9 22l3-3 3 3 1.5-3.5L21 16z" />
            <path d="M12 5l2 6H10l2-6z" strokeLinejoin="round" />
            <path d="M3 16l9-4 9 4" strokeLinecap="round" />
          </svg>
        </span>

        <input
          ref={inputRef}
          type="text"
          dir="ltr"
          value={displayText}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="ds-input ps-9 pe-9 text-sm"
        />

        {/* Clear button */}
        {(value || query) && (
          <button
            type="button"
            onMouseDown={() => { skipBlur.current = true; onChange(null); setQuery(''); setOpen(true); inputRef.current?.focus(); }}
            className="absolute inset-y-0 end-0 flex items-center pe-3 text-gray-400 hover:text-gray-700 transition-colors"
            tabIndex={-1}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showList && (
        <div
          ref={listRef}
          className="absolute z-[200] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden overflow-y-auto"
          style={{ maxHeight: '17rem' }}
          onMouseDown={() => { skipBlur.current = true; }}
        >
          {query.length < 2 && (
            <div className="px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
              Popular airports
            </div>
          )}
          {results.map((apt, i) => (
            <button
              key={apt.iata}
              type="button"
              onMouseDown={() => select(apt)}
              onTouchEnd={() => select(apt)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-start transition-colors ${
                i === highlighted
                  ? 'bg-cyan-50 border-s-2 border-cyan-500'
                  : 'hover:bg-gray-50 border-s-2 border-transparent'
              }`}
            >
              <span className="text-cyan-500 mt-0.5 flex-shrink-0 text-base leading-none">✈</span>
              <span className="flex-1 min-w-0">
                <span className="block text-gray-900 text-sm font-medium truncate">
                  {apt.airport}{' '}
                  <span className="text-cyan-600 font-mono text-xs">({apt.iata})</span>
                </span>
                <span className="block text-gray-500 text-xs mt-0.5">
                  {apt.city}, {apt.country}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
