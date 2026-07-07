import { IconCheck, IconX, IconEdit, IconLoader2, IconAlertCircle } from '@tabler/icons-react';
import { Section, Field, TextArea, Button, DataRow } from '@/components/ui/primitives';
import { Waterfall } from '@/components/ui/Waterfall';
import {
  computePPSF,
  computeTotalUnits,
  validateDocuments,
  validateDetails,
  validateParties,
  validateCommission,
  resolvedBilling,
  conditionalDocErrors,
  brokerSplitTotal,
  paymentTotal,
  allValid,
  num,
} from '@/lib/donedeal/compute';
import { money } from '@/lib/utils/cn';
import type { StepStatus } from '@/lib/donedeal/submit';
import { STEP_LABELS } from '@/lib/donedeal/submit';
import type { StepProps } from './types';

export interface ReviewController {
  submitting: boolean;
  progress: { step: number; status: StepStatus }[];
  error: string | null;
  failedStep: number | null;
  onSubmit: () => void;
}

interface ReviewProps extends StepProps {
  onEdit: (step: number) => void;
  controller: ReviewController;
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-[13px]">
      {ok ? (
        <IconCheck size={15} className="shrink-0 text-brand-green" aria-hidden />
      ) : (
        <IconX size={15} className="shrink-0 text-brand-red" aria-hidden />
      )}
      <span className={ok ? 'text-ink' : 'text-[#b71f37]'}>{label}</span>
    </li>
  );
}

function SummaryCard({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  onEdit: (s: number) => void;
  children: React.ReactNode;
}) {
  return (
    <Section className="!p-[14px]">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[13px] font-bold text-ink">{title}</h4>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-blue hover:underline"
        >
          <IconEdit size={12} aria-hidden /> Edit
        </button>
      </div>
      {children}
    </Section>
  );
}

/** Step 7 — Review & submit (source spec §8.7). */
export function ReviewSubmit({ form, update, onEdit, controller }: ReviewProps) {
  const flags = conditionalDocErrors(form);
  const canSubmit = allValid(form) && !controller.submitting;
  const ppsf = computePPSF(form);

  const checklist = [
    { ok: validateDocuments(form).length === 0, label: 'Required documents uploaded (PSA, exclusive agreement)' },
    { ok: flags.length === 0, label: 'Conditional documents uploaded (co-broker / referral agreements + W-9s)' },
    { ok: validateDetails(form).length === 0, label: 'Required deal detail fields filled' },
    { ok: validateParties(form).length === 0, label: 'Seller, buyer, and billing contact complete' },
    { ok: Math.abs(brokerSplitTotal(form) - 100) < 0.01, label: 'Commission split totals 100%' },
    {
      ok: Math.abs(paymentTotal(form) - num(form.dealDetails.scheduledCommission)) < 0.01,
      label: 'A/R payment total equals scheduled commission',
    },
    { ok: validateCommission(form).length === 0, label: 'All brokers have a profile or name, type, and split' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SummaryCard title="Documents" step={1} onEdit={onEdit}>
          <DataRow label="PSA" value={form.documents.psa[0]?.name} />
          <DataRow label="Exclusive agreement" value={form.documents.exclusiveAgreement[0]?.name} />
          {form.documents.commissionAgreement[0] && (
            <DataRow label="Commission agreement" value={form.documents.commissionAgreement[0]?.name} />
          )}
        </SummaryCard>

        <SummaryCard title="Deal metrics" step={2} onEdit={onEdit}>
          <DataRow label="Property type" value={form.metrics.propertyType} />
          <DataRow label="Total SF" value={form.metrics.totalSf?.toLocaleString()} numeric />
          <DataRow label="PPSF" value={ppsf ? money(ppsf) : ''} numeric />
          <DataRow label="Cap rate" value={form.metrics.capRate ? `${form.metrics.capRate}%` : ''} numeric />
          <DataRow label="Total units" value={computeTotalUnits(form) || ''} numeric />
        </SummaryCard>

        <SummaryCard title="Deal details" step={3} onEdit={onEdit}>
          <DataRow label="Address" value={form.dealDetails.address} />
          <DataRow label="Transaction type" value={form.dealDetails.transactionType} />
          <DataRow label="Final sales price" value={money(num(form.dealDetails.finalSalesPrice))} numeric />
          <DataRow label="Scheduled commission" value={money(num(form.dealDetails.scheduledCommission))} numeric />
          <DataRow label="Close date" value={form.dealDetails.actualCloseDate} numeric />
        </SummaryCard>

        <SummaryCard title="Deal parties" step={4} onEdit={onEdit}>
          <DataRow label="Primary seller" value={form.dealParties.sellers[0]?.name} />
          <DataRow label="Seller company" value={form.dealParties.sellers[0]?.company} />
          <DataRow label="Primary buyer" value={form.dealParties.buyers[0]?.name} />
          <DataRow label="Buyer company" value={form.dealParties.buyers[0]?.company} />
          {form.dealParties.sellers.length > 1 && (
            <DataRow label="Additional sellers" value={form.dealParties.sellers.length - 1} numeric />
          )}
          {form.dealParties.buyers.length > 1 && (
            <DataRow label="Additional buyers" value={form.dealParties.buyers.length - 1} numeric />
          )}
          <DataRow label="Billing contact" value={resolvedBilling(form).name} />
        </SummaryCard>
      </div>

      <SummaryCard title="Deductions" step={5} onEdit={onEdit}>
        <div className="mb-3">
          <Waterfall form={form} />
        </div>
        <DataRow label="Co-broker" value={form.deductions.coBroker} />
        {form.deductions.coBroker === 'Yes' && (
          <DataRow
            label="Co-broker company / fee"
            value={`${form.deductions.coBrokerCompany} · ${form.deductions.coBrokerFeePercent}%`}
          />
        )}
        <DataRow label="Referral" value={form.deductions.referral} />
        {form.deductions.referral === 'Yes' && (
          <DataRow
            label="Referrer / fee"
            value={`${form.deductions.referrerName} · ${form.deductions.referralFeePercent}%`}
          />
        )}
      </SummaryCard>

      <SummaryCard title="Commission" step={6} onEdit={onEdit}>
        <DataRow
          label="House deal"
          value={form.commission.isHouseDeal === 'Yes' ? form.commission.houseDealPrincipal : 'No'}
        />
        {form.commission.brokers.map((b) => (
          <DataRow
            key={b.id}
            label={`${b.name || 'Broker'}${b.isHouseDealPrincipal ? ' (house)' : ''}`}
            value={`${b.participantType || '—'} · ${b.splitPercent || 0}%`}
          />
        ))}
        <DataRow
          label="A/R payments"
          value={`${form.commission.paymentSchedule.length} · ${money(paymentTotal(form))}`}
          numeric
        />
      </SummaryCard>

      {flags.length > 0 && (
        <div className="rounded-button border border-border bg-white p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-[#b71f37]">
            <IconAlertCircle size={15} aria-hidden /> Missing documents
          </p>
          <ul className="ml-6 list-disc space-y-0.5 text-[12.5px] text-[#b71f37]">
            {flags.map((f) => (
              <li key={f}>
                {f}{' '}
                <button
                  type="button"
                  onClick={() => onEdit(5)}
                  className="font-medium text-brand-blue hover:underline"
                >
                  Go to deductions
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Notes to finance">
        <Field label="Deal notes" hint="Pre-filled from the transaction summary. Add anything finance should know.">
          <TextArea
            value={form.dealNotes || form.dealDetails.transactionSummary}
            onChange={(e) => update((d) => (d.dealNotes = e.target.value))}
          />
        </Field>
      </Section>

      <Section title="Submission checklist">
        <ul className="space-y-1.5">
          {checklist.map((c) => (
            <Check key={c.label} ok={c.ok} label={c.label} />
          ))}
        </ul>
      </Section>

      {/* Progress + errors during submit */}
      {controller.progress.length > 0 && (
        <Section title="Submitting to finance">
          <ol className="space-y-2">
            {STEP_LABELS.map((label, i) => {
              const step = i + 1;
              const p = controller.progress.find((x) => x.step === step);
              const status = p?.status ?? 'pending';
              return (
                <li key={label} className="flex items-center gap-2 text-[13px]">
                  {status === 'done' && <IconCheck size={15} className="text-brand-green" aria-hidden />}
                  {status === 'running' && <IconLoader2 size={15} className="animate-spin text-brand-blue" aria-hidden />}
                  {status === 'error' && <IconX size={15} className="text-brand-red" aria-hidden />}
                  {status === 'pending' && <span className="h-[15px] w-[15px] rounded-full border border-border-strong" />}
                  <span className={status === 'error' ? 'text-[#b71f37]' : 'text-ink'}>
                    Step {step}: {label}
                  </span>
                </li>
              );
            })}
          </ol>
          {controller.error && (
            <div className="mt-3 rounded-button border border-border bg-bg-subtle p-3 text-[13px] text-[#b71f37]">
              {controller.error}
            </div>
          )}
        </Section>
      )}

      <div className="flex items-center justify-end gap-3 pb-2">
        {controller.failedStep ? (
          <Button onClick={controller.onSubmit} disabled={controller.submitting}>
            {controller.submitting ? <IconLoader2 size={15} className="animate-spin" aria-hidden /> : null}
            Retry from step {controller.failedStep}
          </Button>
        ) : (
          <Button
            onClick={controller.onSubmit}
            disabled={!canSubmit}
            title={!canSubmit && !controller.submitting ? 'Complete all checklist items to enable submission' : undefined}
          >
            {controller.submitting ? <IconLoader2 size={15} className="animate-spin" aria-hidden /> : null}
            Submit to finance
          </Button>
        )}
      </div>
      {!canSubmit && !controller.submitting && !controller.failedStep && (
        <p className="pb-4 text-right text-[12px] text-muted">Complete all checklist items to enable submission.</p>
      )}
    </div>
  );
}
