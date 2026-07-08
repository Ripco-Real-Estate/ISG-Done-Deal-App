import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Section, Field, TextInput, Select, Button, YesNoToggle } from '@/components/ui/primitives';
import { ContactLookup } from '@/components/ui/ContactLookup';
import { resolvedBilling } from '@/lib/donedeal/compute';
import { makeParty, type FormData, type PartyEntry } from '@/lib/donedeal/types';
import { money } from '@/lib/utils/cn';
import type { LeadOption } from '@/lib/donedeal/read';
import type { StepProps } from './types';

let seq = 0;
const nextId = (p: string) => `${p}-${Date.now()}-${seq++}`;

type Side = 'sellers' | 'buyers';

/** One seller/buyer card. Index 0 is the primary (feeds the structured Finance columns). */
function PartyCard({
  party,
  side,
  index,
  update,
  canRemove,
}: {
  party: PartyEntry;
  side: Side;
  index: number;
  update: StepProps['update'];
  canRemove: boolean;
}) {
  const set = (field: keyof PartyEntry, value: string) =>
    update((d) => {
      d.dealParties[side][index][field] = value;
    });
  const remove = () =>
    update((d) => {
      d.dealParties[side] = d.dealParties[side].filter((p) => p.id !== party.id);
    });
  const isSeller = side === 'sellers';
  const label =
    index === 0 ? (isSeller ? 'Primary seller' : 'Primary buyer') : `${isSeller ? 'Seller' : 'Buyer'} ${index + 1}`;
  return (
    <div className="rounded-button border border-border p-[12px]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-ink">{label}</span>
        {canRemove && (
          <button
            type="button"
            onClick={remove}
            aria-label={`Remove ${label}`}
            className="text-muted transition-colors hover:text-brand-red"
          >
            <IconTrash size={15} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" required={index === 0} hint="Type 2+ letters to search Contacts, or enter free text.">
          <ContactLookup
            value={party.name}
            ariaLabel={`${label} name`}
            onChange={(v) => set('name', v)}
            onSelect={(hit) =>
              update((d) => {
                const p = d.dealParties[side][index];
                p.name = hit.name;
                if (hit.company) p.company = hit.company;
                if (hit.email) p.email = hit.email;
                if (hit.phone) p.phone = hit.phone;
              })
            }
          />
        </Field>
        <Field label="Company">
          <TextInput value={party.company} onChange={(e) => set('company', e.target.value)} />
        </Field>
        <Field label="Email" className={isSeller ? '' : 'sm:col-span-2'}>
          <TextInput value={party.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        {isSeller && (
          <>
            <Field label="Phone">
              <TextInput value={party.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Entity" className="sm:col-span-2">
              <TextInput value={party.entity} onChange={(e) => set('entity', e.target.value)} />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

/** Option label: "Kent Capital — Kent Cap · $12,500,000 · 2026-06-01 (4.2 Offer Accepted)". */
function leadLabel(l: LeadOption): string {
  const parts = [
    l.company && l.company !== l.name ? `— ${l.company}` : '',
    l.offerPrice != null ? `· ${money(l.offerPrice)}` : '',
    l.offerDate ? `· ${l.offerDate}` : '',
    l.status ? `(${l.status})` : '',
  ].filter(Boolean);
  return [l.name, ...parts].join(' ');
}

/** Step 4 — Deal parties. Primary seller pre-filled from mirrors; more parties addable. */
export function DealParties({ form, update, leads }: StepProps) {
  const addParty = (side: Side) =>
    update((d) => {
      d.dealParties[side].push(makeParty(nextId(side)));
    });
  // Winning-buyer picker: selecting a lead fills the primary buyer card and records
  // the lead so submit can mark it 'xx. Buyer' on the Leads Tracker (optional flow).
  const pickWinningLead = (leadId: string) =>
    update((d) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) {
        d.dealParties.winningLead = null;
        return;
      }
      d.dealParties.winningLead = {
        id: lead.id,
        name: lead.name,
        offerPrice: lead.offerPrice,
        offerDate: lead.offerDate,
      };
      const primary = d.dealParties.buyers[0] ?? makeParty('buyer-1');
      primary.name = lead.name;
      primary.company = lead.company;
      primary.email = lead.email;
      primary.phone = lead.phone;
      d.dealParties.buyers[0] = primary;
    });
  return (
    <div className="space-y-4">
      <Section title="Sellers" description="Primary seller is pre-filled from the linked property record. Editable.">
        <div className="space-y-2.5">
          {form.dealParties.sellers.map((p, i) => (
            <PartyCard key={p.id} party={p} side="sellers" index={i} update={update} canRemove={i > 0} />
          ))}
        </div>
        <Button variant="secondary" onClick={() => addParty('sellers')} className="mt-3 h-7 px-2 text-[12px]">
          <IconPlus size={13} aria-hidden /> Add another seller
        </Button>
      </Section>

      <Section title="Buyers" description="Entered by you.">
        {leads.length > 0 && (
          <div className="mb-4">
            <Field
              label="Winning buyer — from Leads Tracker"
              hint="Optional. Fills the primary buyer below; on submit the lead is marked 'xx. Buyer'."
            >
              <Select
                value={form.dealParties.winningLead?.id ?? ''}
                onChange={(e) => pickWinningLead(e.target.value)}
              >
                <option value="">Not selected…</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {leadLabel(l)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <div className="space-y-2.5">
          {form.dealParties.buyers.map((p, i) => (
            <PartyCard key={p.id} party={p} side="buyers" index={i} update={update} canRemove={i > 0} />
          ))}
        </div>
        <Button variant="secondary" onClick={() => addParty('buyers')} className="mt-3 h-7 px-2 text-[12px]">
          <IconPlus size={13} aria-hidden /> Add another buyer
        </Button>
      </Section>

      <BillingSection form={form} update={update} />
    </div>
  );
}

/** Billing contact — drives invoicing; written to the Done Deal and every A/R item. */
function BillingSection({ form, update }: { form: FormData; update: StepProps['update'] }) {
  const b = resolvedBilling(form);
  const locked = form.billing.sameAsSeller;
  const set = (field: keyof FormData['billing'], value: string) =>
    update((d) => {
      (d.billing as unknown as Record<string, string>)[field as string] = value;
    });
  return (
    <Section title="Billing contact" description="Who Finance invoices. Written to the Done Deal and every A/R payment.">
      <Field label="Same as primary seller">
        <YesNoToggle
          value={locked ? 'Yes' : 'No'}
          onChange={(v) => update((d) => { d.billing.sameAsSeller = v === 'Yes'; })}
        />
      </Field>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Contact name"
          required
          hint={locked ? undefined : 'Type 2+ letters to search Contacts, or enter free text.'}
        >
          {locked ? (
            <TextInput value={b.name} disabled />
          ) : (
            <ContactLookup
              value={b.name}
              ariaLabel="Billing contact name"
              onChange={(v) => set('name', v)}
              onSelect={(hit) =>
                update((d) => {
                  d.billing.name = hit.name;
                  if (hit.company) d.billing.company = hit.company;
                  if (hit.phone) d.billing.phone = hit.phone;
                  if (hit.email) d.billing.email1 = hit.email;
                })
              }
            />
          )}
        </Field>
        <Field label="Company" required>
          <TextInput value={b.company} disabled={locked} onChange={(e) => set('company', e.target.value)} />
        </Field>
        <Field label="Billing address" required className="sm:col-span-2">
          <TextInput value={b.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="Phone" required>
          <TextInput value={b.phone} disabled={locked} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Email 1" required>
          <TextInput value={b.email1} disabled={locked} onChange={(e) => set('email1', e.target.value)} />
        </Field>
        <Field label="Email 2">
          <TextInput value={b.email2} onChange={(e) => set('email2', e.target.value)} />
        </Field>
        <Field label="Email 3">
          <TextInput value={b.email3} onChange={(e) => set('email3', e.target.value)} />
        </Field>
        <Field label="Email 4">
          <TextInput value={b.email4} onChange={(e) => set('email4', e.target.value)} />
        </Field>
      </div>
    </Section>
  );
}
