import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * RIPCO UI shared primitives — built to RIPCO-UI.md §9/§16 (v2.0).
 * Button (4 variants, h-8) · Pill (8 tone families, tinted-soft) · SectionCard ·
 * Field (uppercase eyebrow label) · form controls (.form-input) · FieldRow ·
 * YesNoToggle (accent = selected).
 */

// ── Section card (§9.4 / §17.2) ────────────────────────────────────────────
export function Section({
  title,
  icon,
  description,
  children,
  className,
}: {
  title?: string;
  icon?: ReactNode;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-card border border-border bg-white p-[16px]', className)}>
      {title && (
        <header className="mb-[12px]">
          <div className="flex items-center gap-[6px]">
            {icon && <span className="flex-shrink-0 text-muted">{icon}</span>}
            <h3 className="text-[13px] font-bold text-ink">{title}</h3>
          </div>
          {description && <p className="mt-0.5 text-[12px] text-muted">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

// ── Field with uppercase eyebrow label (§9.2) ────────────────────────────────
export function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="field-label mb-[4px] block">
        {label}
        {required && <span className="ml-0.5 text-brand-red">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

// ── Form controls — 32px, .form-input (§9.2) ────────────────────────────────
export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('form-input h-8 text-[13px]', props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('form-textarea text-[13px]', props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn('form-input h-8 text-[13px]', props.className)} />;
}

// ── Formatted numeric inputs (currency / thousands) ─────────────────────────
// Stores a number|null; shows a formatted value when idle and the raw digits
// while editing (an internal text buffer avoids caret jumps and lets you type
// decimals). onChange fires the parsed number on every keystroke.
type NumericInputProps = {
  value: number | null;
  onChange: (n: number | null) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

function parseNumeric(s: string): number | null {
  const cleaned = s.replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function FormattedNumberInput({
  value,
  onChange,
  format,
  className,
  ...rest
}: NumericInputProps & { format: (n: number) => string }) {
  // `buffer` holds exactly what the user types while focused; null = idle (show formatted).
  const [buffer, setBuffer] = useState<string | null>(null);
  const display = buffer !== null ? buffer : value === null ? '' : format(value);
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      className={cn('form-input h-8 text-[13px] num', className)}
      value={display}
      onFocus={() => setBuffer(value === null ? '' : String(value))}
      onBlur={() => setBuffer(null)}
      onChange={(e) => {
        setBuffer(e.target.value);
        onChange(parseNumeric(e.target.value));
      }}
    />
  );
}

const fmtCurrency = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtThousands = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** USD input ($ + thousands when idle), e.g. $1,250,000. */
export function CurrencyInput(props: NumericInputProps) {
  return <FormattedNumberInput {...props} format={fmtCurrency} />;
}

/** Plain number input with thousands separators when idle, e.g. 24,000. */
export function NumberInput(props: NumericInputProps) {
  return <FormattedNumberInput {...props} format={fmtThousands} />;
}

// ── Yes/No segmented toggle — accent marks the selected segment (§0.3) ──────
export function YesNoToggle({
  value,
  onChange,
  disabled,
}: {
  value: 'Yes' | 'No';
  onChange: (v: 'Yes' | 'No') => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-button border border-border-strong">
      {(['No', 'Yes'] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={cn(
            'h-8 px-4 text-[13px] transition-colors',
            value === opt
              ? 'bg-brand-blue-light font-medium text-brand-blue'
              : 'bg-white text-muted hover:text-ink',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── Status pill — the 8 tone families, tinted-soft with dot (§2.4 / §9.3) ───
export type PillTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'teal' | 'navy' | 'gray';

const PILL_TONES: Record<PillTone, { fill: string; text: string; dot: string }> = {
  blue: { fill: 'bg-brand-blue-light', text: 'text-[#1d4ed8]', dot: 'bg-brand-blue' },
  green: { fill: 'bg-brand-green/10', text: 'text-[#00875c]', dot: 'bg-brand-green' },
  orange: { fill: 'bg-brand-orange/15', text: 'text-[#b87514]', dot: 'bg-brand-orange' },
  red: { fill: 'bg-brand-red/10', text: 'text-[#b71f37]', dot: 'bg-brand-red' },
  purple: { fill: 'bg-brand-purple/10', text: 'text-[#7232a8]', dot: 'bg-brand-purple' },
  teal: { fill: 'bg-brand-teal/10', text: 'text-[#00696c]', dot: 'bg-brand-teal' },
  navy: { fill: 'bg-brand-navy/10', text: 'text-brand-navy', dot: 'bg-brand-navy' },
  gray: { fill: 'bg-bg border border-border', text: 'text-muted', dot: 'bg-muted' },
};

export function Pill({
  children,
  tone = 'gray',
  dot,
  className,
}: {
  children: ReactNode;
  tone?: PillTone;
  dot?: boolean;
  className?: string;
}) {
  const t = PILL_TONES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[6px] rounded-full px-[10px] py-[3px] text-[12px] font-medium',
        t.fill,
        t.text,
        className,
      )}
    >
      {dot && <span className={cn('inline-block h-[6px] w-[6px] rounded-full', t.dot)} />}
      {children}
    </span>
  );
}

// ── Button — 4 variants, one primary per surface (§9.1) ─────────────────────
export function Button({
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  const variants = {
    primary: 'bg-brand-blue text-white hover:bg-brand-blue-hover',
    secondary: 'bg-white border border-border-strong text-ink hover:bg-bg-subtle',
    ghost: 'text-ink hover:bg-bg-subtle',
    danger: 'bg-brand-red text-white hover:opacity-90',
  } as const;
  return (
    <button
      {...props}
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-button px-3 text-[13px] font-medium',
        'transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-focus)]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55',
        variants[variant],
        className,
      )}
    />
  );
}

// ── Stat / KPI card — borderless figure (§9.10) ─────────────────────────────
export function StatCard({ label, value, numeric }: { label: string; value: ReactNode; numeric?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted">{label}</div>
      <div className={cn('truncate text-[20px] font-medium leading-7 text-ink', numeric && 'num')}>
        {value || <span className="text-faint">—</span>}
      </div>
    </div>
  );
}

// ── Field row — label-left / value-right on a hairline (§16 FieldRow) ────────
export function DataRow({ label, value, numeric }: { label: string; value: ReactNode; numeric?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-[6px] last:border-0">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className={cn('text-right text-[13px] text-ink', numeric && 'num')}>
        {value || <span className="text-faint">—</span>}
      </span>
    </div>
  );
}
