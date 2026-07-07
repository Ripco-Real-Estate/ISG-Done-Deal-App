import { useEffect, useRef, useState } from 'react';
import { IconSearch, IconLoader2 } from '@tabler/icons-react';
import { searchContacts, type ContactHit } from '@/lib/donedeal/contacts';
import { Pill } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';

/**
 * Type-ahead over the ISG Contacts board. Fill-only: selecting a hit calls
 * onSelect and the caller copies fields; free text is always valid. Silent
 * until 2+ chars; debounced 300ms; errors degrade to no results (search is a
 * convenience, never a blocker). Absolute popover — no position:fixed (iframe).
 */
export function ContactLookup({
  value,
  onChange,
  onSelect,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (hit: ContactHit) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [hits, setHits] = useState<ContactHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  function query(term: string) {
    if (timer.current) clearTimeout(timer.current);
    if (term.trim().length < 2) {
      setHits([]);
      setOpen(false);
      setSearching(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const seq = ++seqRef.current;
      setSearching(true);
      const results = await searchContacts(term);
      if (seq !== seqRef.current) return; // a newer search superseded this one
      setSearching(false);
      setHits(results);
      setOpen(results.length > 0);
      setActive(-1);
    }, 300);
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(hit: ContactHit) {
    setOpen(false);
    setHits([]);
    onSelect(hit);
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            query(e.target.value);
          }}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && active >= 0) {
              e.preventDefault();
              pick(hits[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-expanded={open}
          role="combobox"
          autoComplete="off"
          className="form-input h-8 w-full pr-8 text-[13px]"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted">
          {searching ? (
            <IconLoader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <IconSearch size={14} aria-hidden />
          )}
        </span>
      </div>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-[34px] z-20 max-h-56 overflow-auto rounded-button border border-border bg-white py-1 shadow-md"
        >
          {hits.map((h, i) => (
            <li key={h.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(h);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px]',
                  i === active ? 'bg-bg-subtle' : 'hover:bg-bg-subtle',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{h.name}</span>
                  {h.company && <span className="block truncate text-[11.5px] text-muted">{h.company}</span>}
                </span>
                {h.type && <Pill tone="navy">{h.type}</Pill>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
