import { IconCheck } from '@tabler/icons-react';
import { cn } from '@/lib/utils/cn';

export const STEP_NAMES = [
  'Documents',
  'Deal metrics',
  'Deal details',
  'Deal parties',
  'Deductions',
  'Commission',
  'Review',
] as const;

/**
 * 7-step indicator bar — all steps always visible, no horizontal scroll
 * (source spec §7.2). RIPCO UI: accent marks the active step, tint marks done,
 * neutrals otherwise; sentence-case labels (§0.1); hairline connectors.
 */
export function StepNav({
  current,
  completed,
  onJump,
}: {
  current: number; // 1-based
  completed: Set<number>;
  onJump: (step: number) => void;
}) {
  return (
    <nav className="flex w-full items-center" aria-label="Wizard steps">
      {STEP_NAMES.map((name, i) => {
        const step = i + 1;
        const isCurrent = step === current;
        const isDone = completed.has(step) && !isCurrent;
        const reachable = step <= current || completed.has(step);
        return (
          <div key={name} className="flex min-w-0 flex-1 items-center">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onJump(step)}
              className={cn(
                'flex min-w-0 flex-col items-center gap-1 px-1 focus-visible:outline-none',
                reachable ? 'cursor-pointer' : 'cursor-not-allowed',
              )}
              title={name}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-medium transition-colors',
                  isCurrent && 'border-brand-blue bg-brand-blue text-white',
                  isDone && 'border-brand-blue/40 bg-brand-blue-light text-brand-blue',
                  !isCurrent && !isDone && 'border-border-strong bg-white text-faint',
                )}
              >
                {isDone ? <IconCheck size={15} /> : step}
              </span>
              <span
                className={cn(
                  'max-w-full truncate text-[11px]',
                  isCurrent ? 'font-medium text-brand-blue' : 'text-muted',
                )}
              >
                {name}
              </span>
            </button>
            {i < STEP_NAMES.length - 1 && (
              <span className={cn('mx-1 h-px flex-1', isDone ? 'bg-brand-blue/30' : 'bg-border')} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
