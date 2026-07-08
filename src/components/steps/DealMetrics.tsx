import { Section, Field, TextInput, Select, YesNoToggle, NumberInput } from '@/components/ui/primitives';
import { PROPERTY_TYPES } from '@/lib/donedeal/columns';
import { computePPSF, computeTotalUnits, num } from '@/lib/donedeal/compute';
import { money } from '@/lib/utils/cn';
import type { StepProps } from './types';

const parseNum = (v: string): number | null => (v === '' ? null : Number.isFinite(+v) ? +v : null);

/** Step 2 — Deal metrics (source spec §8.2). */
export function DealMetrics({ form, update }: StepProps) {
  const m = form.metrics;
  const ppsf = computePPSF(form);
  const totalUnits = computeTotalUnits(form);

  return (
    <Section
      title="Deal metrics"
      description="Property characteristics. Pre-filled from the listing where available — edit as needed."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Property type">
          <Select value={m.propertyType} onChange={(e) => update((d) => (d.metrics.propertyType = e.target.value))}>
            <option value="">Select…</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Total SF" hint="Pre-filled from the property record; editable.">
          <NumberInput value={m.totalSf} onChange={(n) => update((d) => (d.metrics.totalSf = n))} />
        </Field>

        <Field label="PPSF" hint="Final sales price ÷ total SF.">
          <TextInput className="num" value={ppsf ? money(ppsf) : '—'} readOnly disabled />
        </Field>

        <Field label="Cap rate (%)">
          <TextInput
            type="number"
            value={m.capRate ?? ''}
            onChange={(e) => update((d) => (d.metrics.capRate = parseNum(e.target.value)))}
          />
        </Field>

        <Field label="Residential units" hint='Supports "N/A".'>
          <TextInput value={m.resiUnits} onChange={(e) => update((d) => (d.metrics.resiUnits = e.target.value))} />
        </Field>

        <Field label="Commercial units">
          <TextInput
            type="number"
            value={m.commUnits ?? ''}
            onChange={(e) => update((d) => (d.metrics.commUnits = parseNum(e.target.value)))}
          />
        </Field>

        <Field label="Total units" hint={`Auto: residential + commercial = ${totalUnits}. Editable.`}>
          <TextInput
            type="number"
            value={m.totalUnits ?? ''}
            placeholder={String(totalUnits)}
            onChange={(e) => update((d) => (d.metrics.totalUnits = parseNum(e.target.value)))}
          />
        </Field>

        <Field label="Is development?">
          <YesNoToggle value={m.isDevelopment} onChange={(v) => update((d) => (d.metrics.isDevelopment = v))} />
        </Field>

        <Field label="Is multi-property?">
          <YesNoToggle value={m.isMultiProperty} onChange={(v) => update((d) => (d.metrics.isMultiProperty = v))} />
        </Field>
      </div>
      {num(form.dealDetails.finalSalesPrice) > 0 && num(m.totalSf) <= 0 && (
        <p className="mt-3 text-[12px] text-muted">Enter total SF to calculate PPSF.</p>
      )}
    </Section>
  );
}
