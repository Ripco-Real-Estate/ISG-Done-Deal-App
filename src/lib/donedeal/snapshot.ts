import type { FormData, PartyEntry } from './types';
import type { Waterfall } from './compute';
import { effectivePayments, resolvedBilling, num } from './compute';
import { money } from '../utils/cn';

/**
 * A full, human-readable snapshot of everything entered in the wizard. Posted as a
 * monday Update on BOTH the ISG Listing and the created Done Deal, so there is an
 * immutable record of exactly what was submitted (and every seller/buyer, even the
 * ones that don't fit the single structured Client field). Pure + deterministic
 * (no Date) so it is unit-testable.
 */

const FILE_LABELS: Array<[keyof FormData['documents'], string]> = [
  ['psa', 'PSA'],
  ['exclusiveAgreement', 'Exclusive Agreement'],
  ['commissionAgreement', 'Commission Agreement'],
  ['coBrokerAgreement', 'Co-Broker Agreement'],
  ['coBrokerW9', 'Co-Broker W-9'],
  ['referralAgreement', 'Referral Agreement'],
  ['referralW9', 'Referral W-9'],
];

/** `  Label: value` — or null when the value is empty (filtered out). */
function row(label: string, value: string | number | null | undefined): string | null {
  if (value === '' || value === null || value === undefined) return null;
  return `  ${label}: ${value}`;
}

function partyLines(parties: PartyEntry[]): string[] {
  if (parties.length === 0) return ['  (none)'];
  return parties.map((p, i) => {
    const rest = [p.company, p.email, p.phone, p.entity].filter(Boolean).join(' · ');
    return `  ${i + 1}) ${p.name || '(unnamed)'}${rest ? ` — ${rest}` : ''}`;
  });
}

export function buildContextSnapshot(form: FormData, wf: Waterfall): string {
  const d = form.dealDetails;
  const m = form.metrics;
  const dd = form.deductions;
  const c = form.commission;
  const b = resolvedBilling(form);
  const s: Array<string | null> = [];

  s.push('ISG DONE DEAL — SUBMISSION SNAPSHOT', '');

  s.push('DEAL');
  s.push(row('Property Address', d.address));
  s.push(row('Transaction Type', d.transactionType));
  s.push(row('Source Type', d.sourceType));
  s.push(row('Final Sales Price', d.finalSalesPrice != null ? money(d.finalSalesPrice) : null));
  s.push(row('Contract Price', d.contractPrice != null ? money(d.contractPrice) : null));
  s.push(row('Base Rate', d.baseRate != null ? `${d.baseRate}%` : null));
  s.push(row('Scheduled Commission', d.scheduledCommission != null ? money(d.scheduledCommission) : null));
  s.push(row('Actual Close Date', d.actualCloseDate));
  s.push('');

  s.push('PROPERTY');
  s.push(row('Property Type', m.propertyType));
  s.push(row('Total SF', m.totalSf != null ? m.totalSf.toLocaleString('en-US') : null));
  s.push(row('Cap Rate', m.capRate != null ? `${m.capRate}%` : null));
  s.push(row('Residential Units', m.resiUnits));
  s.push(row('Commercial Units', m.commUnits));
  s.push(row('Total Units', m.totalUnits));
  s.push(row('Development', m.isDevelopment));
  s.push(row('Multi-Property', m.isMultiProperty));
  s.push('');

  s.push('SELLERS', ...partyLines(form.dealParties.sellers), '');
  s.push('BUYERS', ...partyLines(form.dealParties.buyers));
  const lead = form.dealParties.winningLead;
  if (lead) {
    const terms = [
      lead.offerPrice != null ? `offer ${money(lead.offerPrice)}` : '',
      lead.offerDate ? `on ${lead.offerDate}` : '',
    ].filter(Boolean).join(' ');
    s.push(`  Winning lead (Leads Tracker ${lead.id}): ${lead.name}${terms ? ` — ${terms}` : ''}`);
  }
  s.push('');

  s.push('BILLING');
  s.push(row('Name', b.name));
  s.push(row('Company', b.company));
  s.push(row('Address', b.address));
  s.push(row('Phone', b.phone));
  s.push(row('Email 1', b.email1));
  s.push(row('Email 2', b.email2));
  s.push(row('Email 3', b.email3));
  s.push(row('Email 4', b.email4));
  s.push('');

  s.push('DEDUCTIONS');
  s.push(row('Co-Broker', dd.coBroker));
  if (dd.coBroker === 'Yes') {
    s.push(row('  Co-Broker Company', dd.coBrokerCompany));
    s.push(row('  Co-Broker Fee %', dd.coBrokerFeePercent ? `${dd.coBrokerFeePercent}%` : null));
    s.push(row('  Co-Broker Fee $', money(wf.coBrokerFee)));
    s.push(row('  Payment Method', dd.coBrokerPaymentMethod));
  }
  s.push(row('Referral', dd.referral));
  if (dd.referral === 'Yes') {
    s.push(row('  Referrer', dd.referrerName));
    s.push(row('  Referral Fee %', dd.referralFeePercent ? `${dd.referralFeePercent}%` : null));
    s.push(row('  Referral Fee $', money(wf.referralFee)));
    s.push(row('  Payment Method', dd.referralPaymentMethod));
  }
  s.push(row('Concessions', money(wf.concessions)));
  s.push('');

  s.push('COMMISSION');
  s.push(row('Full Commission', money(wf.fullCommission)));
  s.push(row('Net to RIPCO', money(wf.netToRipco)));
  s.push(row('Gross Commission (split)', money(wf.grossCommission)));
  s.push(row('House Deal', c.isHouseDeal));
  if (c.isHouseDeal === 'Yes') s.push(row('House Deal Principal', c.houseDealPrincipal));
  s.push('  Splits:');
  if (c.brokers.length === 0) {
    s.push('    (none)');
  } else {
    for (const br of c.brokers) {
      const who = br.name || '(unnamed)';
      const type = br.isHouseDealPrincipal ? 'Originator (House Deal principal)' : br.participantType || '—';
      s.push(`    - ${who} · ${type} · ${num(br.splitPercent)}%`);
    }
  }
  s.push('');

  s.push('A/R SCHEDULE');
  const payments = effectivePayments(form);
  payments.forEach((p, i) => {
    const due = p.dueDate || d.actualCloseDate || '—';
    s.push(`  Payment ${i + 1} of ${payments.length}: ${money(num(p.amount))} · due ${due}`);
  });
  s.push('');

  s.push('DOCUMENTS');
  const docLines = FILE_LABELS.filter(([k]) => form.documents[k].length > 0).map(
    ([k, label]) => `  ${label}: ${form.documents[k].length} file(s)`,
  );
  s.push(...(docLines.length ? docLines : ['  (none attached)']));

  if (form.dealNotes.trim()) {
    s.push('', 'NOTES', `  ${form.dealNotes.trim()}`);
  }

  return s.filter((l): l is string => l !== null).join('\n');
}
