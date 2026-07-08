import { Section, Field, TextInput, TextArea, Select, CurrencyInput } from '@/components/ui/primitives';
import { TRANSACTION_TYPES, SOURCE_TYPES } from '@/lib/donedeal/columns';
import type { StepProps } from './types';

const parseNum = (v: string): number | null => (v === '' ? null : Number.isFinite(+v) ? +v : null);

/** Step 3 — Deal details (source spec §8.3). Field order per RIPCO request 2026-07-08. */
export function DealDetails({ form, update }: StepProps) {
  const d = form.dealDetails;
  return (
    <Section title="Deal details" description="Transaction financials and dates.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Property address" required className="sm:col-span-2">
          <TextInput value={d.address} onChange={(e) => update((s) => (s.dealDetails.address = e.target.value))} />
        </Field>

        <Field label="Transaction type" required>
          <Select
            value={d.transactionType}
            onChange={(e) => update((s) => (s.dealDetails.transactionType = e.target.value))}
          >
            <option value="">Select…</option>
            {TRANSACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Source type">
          <Select value={d.sourceType} onChange={(e) => update((s) => (s.dealDetails.sourceType = e.target.value))}>
            <option value="">Select…</option>
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Final sales price" required>
          <CurrencyInput
            value={d.finalSalesPrice}
            onChange={(n) => update((s) => (s.dealDetails.finalSalesPrice = n))}
          />
        </Field>

        <Field label="Contract price">
          <CurrencyInput
            value={d.contractPrice}
            onChange={(n) => update((s) => (s.dealDetails.contractPrice = n))}
          />
        </Field>

        <Field label="Base rate (%)" required>
          <TextInput
            type="number"
            className="num"
            value={d.baseRate ?? ''}
            onChange={(e) => update((s) => (s.dealDetails.baseRate = parseNum(e.target.value)))}
          />
        </Field>

        <Field label="Scheduled commission" required>
          <CurrencyInput
            value={d.scheduledCommission}
            onChange={(n) => update((s) => (s.dealDetails.scheduledCommission = n))}
          />
        </Field>

        <Field label="Actual close date" required>
          <TextInput
            type="date"
            value={d.actualCloseDate}
            onChange={(e) => update((s) => (s.dealDetails.actualCloseDate = e.target.value))}
          />
        </Field>

        <Field label="Transaction summary" className="sm:col-span-2">
          <TextArea
            value={d.transactionSummary}
            onChange={(e) => update((s) => (s.dealDetails.transactionSummary = e.target.value))}
          />
        </Field>
      </div>
    </Section>
  );
}
