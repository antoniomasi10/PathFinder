'use client';

import { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowCustom?: boolean;
  onSearchChange?: (search: string) => void;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Cerca...',
  required = false,
  disabled = false,
  allowCustom = false,
}: SearchableSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display text with selected value
  useEffect(() => {
    if (!isOpen) {
      const selected = options.find((o) => o.value === value);
      setSearch(selected ? selected.label : value || '');
    }
  }, [value, options, isOpen]);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // If custom not allowed, reset to selected value
        if (!allowCustom) {
          const selected = options.find((o) => o.value === value);
          setSearch(selected ? selected.label : '');
        } else if (search) {
          // For custom, set value to typed text
          const match = options.find((o) => o.label.toLowerCase() === search.toLowerCase());
          onChange(match ? match.value : search);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [search, value, options, allowCustom, onChange]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const handleSelect = (option: Option) => {
    onChange(option.value);
    setSearch(option.label);
    setIsOpen(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && filtered[highlightIndex]) {
        handleSelect(filtered[highlightIndex]);
      } else if (allowCustom && search) {
        onChange(search);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        className="input-field w-full"
        placeholder={placeholder}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
          setHighlightIndex(-1);
          if (allowCustom) {
            onChange(e.target.value);
          } else if (!e.target.value) {
            onChange('');
          }
        }}
        onFocus={() => {
          setIsOpen(true);
          setSearch('');
        }}
        onKeyDown={handleKeyDown}
        required={required}
        disabled={disabled}
        autoComplete="off"
      />

      {/* Hidden input for required validation when using value IDs */}
      {required && !allowCustom && (
        <input
          type="text"
          value={value}
          required
          className="sr-only"
          tabIndex={-1}
          onChange={() => {}}
        />
      )}

      {isOpen && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-xl bg-card-bg border border-white/10 shadow-lg"
        >
          {filtered.slice(0, 100).map((option, i) => (
            <li
              key={option.value}
              className={`px-3 py-2 cursor-pointer text-sm transition-colors ${
                i === highlightIndex
                  ? 'bg-primary/20 text-text-primary'
                  : option.value === value
                  ? 'bg-white/5 text-text-primary'
                  : 'text-text-secondary hover:bg-white/5'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(option);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}

      {isOpen && search && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl bg-card-bg border border-white/10 shadow-lg px-3 py-2 text-sm text-text-secondary">
          Nessun risultato
        </div>
      )}
    </div>
  );
}
