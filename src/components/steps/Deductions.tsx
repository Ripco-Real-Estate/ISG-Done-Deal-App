import { Section, Field, TextInput, Select, YesNoToggle } from '@/components/ui/primitives';
import { Waterfall } from '@/components/ui/Waterfall';
import { ISG } from '@/lib/donedeal/columns';
import { computeWaterfall } from '@/lib/donedeal/compute';
import { money } from '@/lib/utils/cn';
import { FileSlot } from './FileSlot';
import type { StepProps } from './types';

/** Step 5 — Deductions (source spec §8.5). */
export function Deductions({ form, update, itemId, onUploadingChange }: StepProps) {
  const dd = form.deductions;
  const wf = computeWaterfall(form);

  return (
    <div className="space-y-4">
      <Waterfall form={form} />

      <Section title="Co-broker">
        <Field label="Is there a co-broker?">
          <YesNoToggle value={dd.coBroker} onChange={(v) => update((d) => (d.deductions.coBroker = v))} />
        </Field>
        {dd.coBroker === 'Yes' && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Co-broker company" required>
              <TextInput
                value={dd.coBrokerCompany}
                onChange={(e) => update((d) => (d.deductions.coBrokerCompany = e.target.value))}
              />
            </Field>
            <Field label="Co-broker fee (%)" required>
              <TextInput
                type="number"
                className="num"
                value={dd.coBrokerFeePercent}
                onChange={(e) => update((d) => (d.deductions.coBrokerFeePercent = e.target.value))}
              />
            </Field>
            <Field label="Co-broker fee ($)" hint="Full commission × %">
              <TextInput className="num" value={money(wf.coBrokerFee)} readOnly disabled />
            </Field>
            <Field label="Payment method" required>
              <Select
                value={dd.coBrokerPaymentMethod}
                onChange={(e) =>
                  update((d) => (d.deductions.coBrokerPaymentMethod = e.target.value as typeof dd.coBrokerPaymentMethod))
                }
              >
                <option value="">Select…</option>
                <option value="paid_at_closing">Paid at closing</option>
                <option value="paid_by_ripco">Paid by RIPCO</option>
              </Select>
            </Field>
            <div className="grid grid-cols-1 gap-2.5 sm:col-span-2 sm:grid-cols-2">
              <FileSlot
                label="Co-broker agreement"
                required
                columnId={ISG.fileCoBrokerAgreement}
                itemId={itemId}
                files={form.documents.coBrokerAgreement}
                onUploadingChange={onUploadingChange}
                onUploaded={(f) => update((d) => (d.documents.coBrokerAgreement = [f]))}
              />
              <FileSlot
                label="Co-broker W-9"
                required
                columnId={ISG.fileCoBrokerW9}
                itemId={itemId}
                files={form.documents.coBrokerW9}
                onUploadingChange={onUploadingChange}
                onUploaded={(f) => update((d) => (d.documents.coBrokerW9 = [f]))}
              />
            </div>
          </div>
        )}
      </Section>

      <Section title="Referral">
        <Field label="Is there a referral?">
          <YesNoToggle value={dd.referral} onChange={(v) => update((d) => (d.deductions.referral = v))} />
        </Field>
        {dd.referral === 'Yes' && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Referrer name / company" required>
              <TextInput
                value={dd.referrerName}
                onChange={(e) => update((d) => (d.deductions.referrerName = e.target.value))}
              />
            </Field>
            <Field label="Referral fee (%)" required>
              <TextInput
                type="number"
                className="num"
                value={dd.referralFeePercent}
                onChange={(e) => update((d) => (d.deductions.referralFeePercent = e.target.value))}
              />
            </Field>
            <Field label="Referral fee ($)" hint="Net to RIPCO × %">
              <TextInput className="num" value={money(wf.referralFee)} readOnly disabled />
            </Field>
            <Field label="Payment method" required>
              <Select
                value={dd.referralPaymentMethod}
                onChange={(e) =>
                  update((d) => (d.deductions.referralPaymentMethod = e.target.value as typeof dd.referralPaymentMethod))
                }
              >
                <option value="">Select…</option>
                <option value="paid_at_closing">Paid at closing</option>
                <option value="paid_by_ripco">Paid by RIPCO</option>
              </Select>
            </Field>
            <div className="grid grid-cols-1 gap-2.5 sm:col-span-2 sm:grid-cols-2">
              <FileSlot
                label="Referral agreement"
                required
                columnId={ISG.fileReferralAgreement}
                itemId={itemId}
                files={form.documents.referralAgreement}
                onUploadingChange={onUploadingChange}
                onUploaded={(f) => update((d) => (d.documents.referralAgreement = [f]))}
              />
              <FileSlot
                label="Referral W-9"
                required
                columnId={ISG.fileReferralW9}
                itemId={itemId}
                files={form.documents.referralW9}
                onUploadingChange={onUploadingChange}
                onUploaded={(f) => update((d) => (d.documents.referralW9 = [f]))}
              />
            </div>
          </div>
        )}
      </Section>

      <Section title="Concessions">
        <Field label="Concessions ($)" hint="Deducted from net to RIPCO to reach gross commission.">
          <TextInput
            type="number"
            className="num"
            value={dd.concessions || ''}
            onChange={(e) => update((d) => (d.deductions.concessions = e.target.value === '' ? 0 : +e.target.value))}
          />
        </Field>
      </Section>
    </div>
  );
}
