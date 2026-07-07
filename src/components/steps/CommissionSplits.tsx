import { IconPlus, IconTrash, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { Section, Field, TextInput, Select, YesNoToggle, Button, Pill } from '@/components/ui/primitives';
import { HOUSE_DEAL_PRINCIPALS, HOUSE_DEAL_SPLIT } from '@/lib/donedeal/columns';
import {
  brokerSplitTotal,
  effectivePayments,
  paymentTotal,
  paymentsBalance,
  splitsBalance,
  num,
} from '@/lib/donedeal/compute';
import { money } from '@/lib/utils/cn';
import type { BrokerEntry, Profile } from '@/lib/donedeal/types';
import type { StepProps } from './types';

let seq = 0;
const nextId = (p: string) => `${p}-${Date.now()}-${seq++}`;

function principalRow(name: string, profiles: Profile[]): BrokerEntry {
  const profile = profiles.find((p) => p.name.toLowerCase() === name.toLowerCase());
  return {
    id: nextId('broker'),
    profileId: profile?.id ?? '',
    name,
    participantType: 'Originator',
    splitPercent: String(HOUSE_DEAL_SPLIT),
    isHouseDealPrincipal: true,
  };
}

/** Step 6 — Commission & splits + A/R payment schedule (source spec §8.6). */
export function CommissionSplits({ form, update, profiles }: StepProps) {
  const c = form.commission;
  const activeProfiles = profiles.filter((p) => p.active);
  const splitTotal = brokerSplitTotal(form);
  const splitsOk = splitsBalance(form);
  const payTotal = paymentTotal(form);
  const payOk = paymentsBalance(form);
  const scheduled = num(form.dealDetails.scheduledCommission);

  // ── House deal ────────────────────────────────────────────────────────────
  function setHouseDeal(v: 'Yes' | 'No') {
    update((d) => {
      d.commission.isHouseDeal = v;
      d.commission.brokers = d.commission.brokers.filter((b) => !b.isHouseDealPrincipal);
      if (v === 'No') d.commission.houseDealPrincipal = '';
      else if (d.commission.houseDealPrincipal) {
        d.commission.brokers.unshift(principalRow(d.commission.houseDealPrincipal, profiles));
      }
    });
  }
  function setPrincipal(name: string) {
    update((d) => {
      d.commission.houseDealPrincipal = name;
      d.commission.brokers = d.commission.brokers.filter((b) => !b.isHouseDealPrincipal);
      if (name) d.commission.brokers.unshift(principalRow(name, profiles));
    });
  }

  // ── Broker rows ─────────────────────────────────────────────────────────────
  function addBroker() {
    update((d) =>
      d.commission.brokers.push({
        id: nextId('broker'),
        profileId: '',
        name: '',
        participantType: '',
        splitPercent: '',
      }),
    );
  }
  function removeBroker(id: string) {
    update((d) => (d.commission.brokers = d.commission.brokers.filter((b) => b.id !== id)));
  }
  function updateBroker(id: string, field: keyof BrokerEntry, value: string) {
    update((d) => {
      const b = d.commission.brokers.find((x) => x.id === id);
      if (b) (b as unknown as Record<string, unknown>)[field] = value;
    });
  }

  // ── A/R payments ─────────────────────────────────────────────────────────────
  function toggleMultiple(v: 'Yes' | 'No') {
    update((d) => {
      d.commission.multiplePayments = v === 'Yes';
      if (v === 'No') d.commission.paymentSchedule = [{ id: 'payment-1', amount: scheduled, dueDate: '' }];
    });
  }
  function addPayment() {
    update((d) => d.commission.paymentSchedule.push({ id: nextId('payment'), amount: 0, dueDate: '' }));
  }
  function removePayment(id: string) {
    update((d) => {
      if (d.commission.paymentSchedule.length > 1)
        d.commission.paymentSchedule = d.commission.paymentSchedule.filter((p) => p.id !== id);
    });
  }
  function updatePayment(id: string, amount: number) {
    update((d) => {
      const p = d.commission.paymentSchedule.find((x) => x.id === id);
      if (p) p.amount = amount;
    });
  }
  function updatePaymentDate(id: string, dueDate: string) {
    update((d) => {
      const p = d.commission.paymentSchedule.find((x) => x.id === id);
      if (p) p.dueDate = dueDate;
    });
  }

  return (
    <div className="space-y-4">
      <Section title="House deal">
        <Field label="Is this a house deal?">
          <YesNoToggle value={c.isHouseDeal} onChange={setHouseDeal} />
        </Field>
        {c.isHouseDeal === 'Yes' && (
          <div className="mt-4">
            <Field
              label="House deal principal"
              required
              hint={`Locked at ${HOUSE_DEAL_SPLIT}%. Brokers fill the remaining ${100 - HOUSE_DEAL_SPLIT}%.`}
            >
              <Select value={c.houseDealPrincipal} onChange={(e) => setPrincipal(e.target.value)}>
                <option value="">Select principal…</option>
                {HOUSE_DEAL_PRINCIPALS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </Section>

      <Section title="Commission splits" description="Each broker's participation and split percentage.">
        {activeProfiles.length === 0 && (
          <p className="mb-3 text-[12px] text-muted">
            No broker profiles loaded — enter broker names manually.
          </p>
        )}
        <div className="space-y-2.5">
          {c.brokers.map((b) => (
            <div
              key={b.id}
              className="grid grid-cols-1 items-end gap-2 rounded-button border border-border p-[10px] sm:grid-cols-[1fr_150px_90px_32px]"
            >
              <Field label={b.isHouseDealPrincipal ? 'Principal (locked)' : 'Broker'}>
                {b.isHouseDealPrincipal ? (
                  <TextInput value={b.name} readOnly disabled />
                ) : activeProfiles.length > 0 ? (
                  <select
                    value={b.profileId}
                    onChange={(e) => updateBroker(b.id, 'profileId', e.target.value)}
                    className="form-input h-8 text-[13px]"
                  >
                    <option value="">Select a broker…</option>
                    {activeProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <TextInput
                    placeholder="Broker name"
                    value={b.name}
                    onChange={(e) => updateBroker(b.id, 'name', e.target.value)}
                  />
                )}
              </Field>
              <Field label="Participant type">
                <Select
                  value={b.participantType}
                  disabled={b.isHouseDealPrincipal}
                  onChange={(e) => updateBroker(b.id, 'participantType', e.target.value)}
                >
                  <option value="">Select…</option>
                  <option value="Originator">Originator</option>
                  <option value="Team Member">Team member</option>
                </Select>
              </Field>
              <Field label="Split %">
                <TextInput
                  type="number"
                  className="num"
                  value={b.splitPercent}
                  readOnly={b.isHouseDealPrincipal}
                  disabled={b.isHouseDealPrincipal}
                  onChange={(e) => updateBroker(b.id, 'splitPercent', e.target.value)}
                />
              </Field>
              <div className="flex h-8 items-center justify-center">
                {!b.isHouseDealPrincipal && (
                  <button
                    type="button"
                    onClick={() => removeBroker(b.id)}
                    className="text-muted transition-colors hover:text-brand-red"
                    aria-label="Remove broker"
                  >
                    <IconTrash size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Button variant="secondary" onClick={addBroker} className="h-7 px-2 text-[12px]">
            <IconPlus size={13} aria-hidden /> Add broker
          </Button>
          <span
            className={`num inline-flex items-center gap-1.5 text-[12.5px] font-medium ${
              splitsOk ? 'text-[#00875c]' : 'text-[#b71f37]'
            }`}
          >
            {splitsOk ? <IconCheck size={15} aria-hidden /> : <IconAlertTriangle size={15} aria-hidden />}
            Total: {splitTotal}% / 100%
          </span>
        </div>
      </Section>

      <Section title="A/R payment schedule" description="How the scheduled commission will be received.">
        <Field label="Multiple payments?">
          <YesNoToggle value={c.multiplePayments ? 'Yes' : 'No'} onChange={toggleMultiple} />
        </Field>

        <div className="mt-4 space-y-2">
          {effectivePayments(form).map((p, i) => (
            <div key={p.id} className="flex items-center gap-3">
              <Pill tone="blue">Payment {i + 1}</Pill>
              <TextInput
                type="number"
                className="num max-w-[200px]"
                aria-label={`Payment ${i + 1} amount`}
                value={p.amount || ''}
                disabled={!c.multiplePayments}
                onChange={(e) => updatePayment(p.id, e.target.value === '' ? 0 : +e.target.value)}
              />
              <TextInput
                type="date"
                className="num max-w-[170px]"
                aria-label={`Payment ${i + 1} due date${c.multiplePayments ? '' : ' (optional)'}`}
                title={c.multiplePayments ? 'Due date' : 'Due date (optional — defaults to close date)'}
                value={p.dueDate || (!c.multiplePayments ? form.dealDetails.actualCloseDate : '')}
                onChange={(e) => updatePaymentDate(p.id, e.target.value)}
              />
              {c.multiplePayments && c.paymentSchedule.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePayment(p.id)}
                  className="text-muted transition-colors hover:text-brand-red"
                  aria-label="Remove payment"
                >
                  <IconTrash size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        {c.multiplePayments && (
          <Button variant="secondary" onClick={addPayment} className="mt-3 h-7 px-2 text-[12px]">
            <IconPlus size={13} aria-hidden /> Add payment
          </Button>
        )}

        <div className="mt-4 flex items-center justify-end">
          <span
            className={`num inline-flex items-center gap-1.5 text-[12.5px] font-medium ${
              payOk ? 'text-[#00875c]' : 'text-[#b71f37]'
            }`}
          >
            {payOk ? <IconCheck size={15} aria-hidden /> : <IconAlertTriangle size={15} aria-hidden />}
            Total: {money(payTotal)} / {money(scheduled)}
          </span>
        </div>
      </Section>
    </div>
  );
}
