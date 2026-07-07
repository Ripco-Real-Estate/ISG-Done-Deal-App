import { Section } from '@/components/ui/primitives';
import { FILE_SLOTS } from '@/lib/donedeal/columns';
import type { UploadedFile } from '@/lib/donedeal/types';
import { FileSlot } from './FileSlot';
import type { StepProps } from './types';

/** Step 1 — Documents. Upload slots ONLY (source spec §8.1). */
export function DocumentUpload({ form, update, itemId, onUploadingChange }: StepProps) {
  const slotFiles: Record<string, UploadedFile[]> = {
    psa: form.documents.psa,
    ea: form.documents.exclusiveAgreement,
    commissionAgreement: form.documents.commissionAgreement,
  };
  const slotKey: Record<string, keyof typeof form.documents> = {
    psa: 'psa',
    ea: 'exclusiveAgreement',
    commissionAgreement: 'commissionAgreement',
  };

  return (
    <Section
      title="Deal documents"
      description="Upload the closing documents. PSA and exclusive agreement are required to proceed."
    >
      <div className="space-y-2.5">
        {FILE_SLOTS.map((slot) => (
          <FileSlot
            key={slot.id}
            label={slot.label}
            columnId={slot.columnId}
            itemId={itemId}
            required={slot.required}
            files={slotFiles[slot.id] ?? []}
            onUploadingChange={onUploadingChange}
            onUploaded={(file) =>
              update((d) => {
                d.documents[slotKey[slot.id]] = [file];
              })
            }
          />
        ))}
      </div>
      <p className="mt-3 text-[12px] text-muted">
        Co-broker and referral paperwork (agreements + W-9s) is collected on the Deductions step
        and becomes required when those deductions apply.
      </p>
    </Section>
  );
}
