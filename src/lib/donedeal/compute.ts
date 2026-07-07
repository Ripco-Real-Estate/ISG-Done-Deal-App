import type { FormData, PartyEntry, PaymentRow } from './types';
import { makeParty } from './types';
import { HOUSE_DEAL_SPLIT, HOUSE_DEAL_REMAINDER } from './columns';

/**
 * Pure commission / waterfall / validation math. No React, no SDK — so it can be
 * unit-tested in isolation and reused by both the live UI and the submit payload
 * builders. Everything downstream renders THIS; it never recomputes money inline.
 */

/** Parse a possibly-empty percent/number string into a finite number, else 0. */
export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,%\s,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Round to cents to avoid float dust in money math. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface Waterfall {
  fullCommission: number;
  coBrokerFee: number;
  netToRipco: number;
  referralFee: number;
  concessions: number;
  grossCommission: number;
}

/**
 * Financial waterfall (source spec §8.5):
 *   Full Commission (Scheduled Commission $)
 *     − Co-Broker Fee (Full × coBroker%)          if Co-Broker = Yes
 *     = Net to RIPCO
 *     − Referral Fee (Net to RIPCO × referral%)    if Referral = Yes
 *     − Concessions
 *     = Gross Commission (split among brokers)
 */
export function computeWaterfall(form: FormData): Waterfall {
  const fullCommission = num(form.dealDetails.scheduledCommission);

  const coBrokerFee =
    form.deductions.coBroker === 'Yes'
      ? round2((fullCommission * num(form.deductions.coBrokerFeePercent)) / 100)
      : 0;

  const netToRipco = round2(fullCommission - coBrokerFee);

  const referralFee =
    form.deductions.referral === 'Yes'
      ? round2((netToRipco * num(form.deductions.referralFeePercent)) / 100)
      : 0;

  const concessions = num(form.deductions.concessions);
  const grossCommission = round2(netToRipco - referralFee - concessions);

  return { fullCommission, coBrokerFee, netToRipco, referralFee, concessions, grossCommission };
}

/** PPSF = Final Sales Price ÷ Total SF (0 when SF missing). */
export function computePPSF(form: FormData): number {
  const sf = num(form.metrics.totalSf);
  if (sf <= 0) return 0;
  return round2(num(form.dealDetails.finalSalesPrice) / sf);
}

/** Total units from resi + comm when Total Units not set explicitly. */
export function computeTotalUnits(form: FormData): number {
  if (form.metrics.totalUnits !== null) return num(form.metrics.totalUnits);
  return num(form.metrics.resiUnits) + num(form.metrics.commUnits);
}

/** The primary seller (index 0) — the one that feeds the structured Finance columns. */
export function primarySeller(form: FormData): PartyEntry {
  return form.dealParties.sellers[0] ?? makeParty('seller-1');
}

/** The primary buyer (index 0). */
export function primaryBuyer(form: FormData): PartyEntry {
  return form.dealParties.buyers[0] ?? makeParty('buyer-1');
}

export interface ResolvedBilling {
  name: string;
  company: string;
  address: string;
  phone: string;
  email1: string;
  email2: string;
  email3: string;
  email4: string;
}

/** Billing as it will be written — sameAsSeller derives live from the primary seller. */
export function resolvedBilling(form: FormData): ResolvedBilling {
  const b = form.billing;
  if (!b.sameAsSeller) {
    return {
      name: b.name, company: b.company, address: b.address, phone: b.phone,
      email1: b.email1, email2: b.email2, email3: b.email3, email4: b.email4,
    };
  }
  const s = primarySeller(form);
  return {
    name: s.name, company: s.company, address: b.address, phone: s.phone,
    email1: s.email, email2: b.email2, email3: b.email3, email4: b.email4,
  };
}

/** Required split total: 100 normally, 83.34 when a house-deal principal takes 16.66. */
export function requiredBrokerSplitTotal(form: FormData): number {
  return form.commission.isHouseDeal === 'Yes' ? HOUSE_DEAL_REMAINDER : 100;
}

/** Sum of all broker split %, including the locked house-deal principal row. */
export function brokerSplitTotal(form: FormData): number {
  return round2(form.commission.brokers.reduce((s, b) => s + num(b.splitPercent), 0));
}

/** Splits are valid when they sum to 100 (house-deal principal's 16.66 + 83.34 = 100). */
export function splitsBalance(form: FormData): boolean {
  return Math.abs(brokerSplitTotal(form) - 100) < 0.01;
}

/**
 * The real payment rows. Single-payment mode derives the amount from Scheduled
 * Commission so edits on step 3 can never leave a stale copy behind.
 */
export function effectivePayments(form: FormData): PaymentRow[] {
  const c = form.commission;
  if (c.multiplePayments) return c.paymentSchedule;
  const first = c.paymentSchedule[0];
  return [
    {
      id: first?.id ?? 'payment-1',
      amount: num(form.dealDetails.scheduledCommission),
      dueDate: first?.dueDate ?? '',
    },
  ];
}

/** Sum of A/R payment rows. */
export function paymentTotal(form: FormData): number {
  return round2(effectivePayments(form).reduce((s, p) => s + num(p.amount), 0));
}

/** A/R rows must equal Scheduled Commission. */
export function paymentsBalance(form: FormData): boolean {
  return Math.abs(paymentTotal(form) - num(form.dealDetails.scheduledCommission)) < 0.01;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-step validation (source spec §14). Each returns the list of problems;
// an empty list means the step may advance.
// ─────────────────────────────────────────────────────────────────────────────

export function validateDocuments(form: FormData): string[] {
  const errs: string[] = [];
  if (form.documents.psa.length === 0) errs.push('PSA is required.');
  if (form.documents.exclusiveAgreement.length === 0) errs.push('Exclusive Agreement is required.');
  return errs;
}

export function validateMetrics(_form: FormData): string[] {
  return []; // all optional per spec
}

export function validateDetails(form: FormData): string[] {
  const errs: string[] = [];
  const d = form.dealDetails;
  if (!d.address.trim()) errs.push('Property Address is required.');
  if (!d.transactionType) errs.push('Transaction Type is required.');
  if (num(d.finalSalesPrice) <= 0) errs.push('Final Sales Price is required.');
  if (num(d.scheduledCommission) <= 0) errs.push('Scheduled Commission is required.');
  if (num(d.baseRate) <= 0) errs.push('Base Rate is required.');
  if (!d.actualCloseDate) errs.push('Actual Close Date is required.');
  return errs;
}

export function validateParties(form: FormData): string[] {
  const errs: string[] = [];
  if (!primarySeller(form).name.trim()) errs.push('Primary Seller name is required.');
  if (!primaryBuyer(form).name.trim()) errs.push('Primary Buyer name is required.');
  const extras = [...form.dealParties.sellers.slice(1), ...form.dealParties.buyers.slice(1)];
  if (extras.some((p) => !p.name.trim()))
    errs.push('Every additional party needs a name — or remove it.');
  const b = resolvedBilling(form);
  if (!b.name.trim()) errs.push('Billing contact name is required.');
  if (!b.company.trim()) errs.push('Billing contact company is required.');
  if (!b.address.trim()) errs.push('Billing address is required.');
  if (!b.phone.trim()) errs.push('Billing phone is required.');
  if (!b.email1.trim()) errs.push('Billing email 1 is required.');
  return errs;
}

/** Docs that become required exactly when their deduction toggle is on. */
export function conditionalDocErrors(form: FormData): string[] {
  const errs: string[] = [];
  if (form.deductions.coBroker === 'Yes') {
    if (form.documents.coBrokerAgreement.length === 0) errs.push('Co-broker agreement missing.');
    if (form.documents.coBrokerW9.length === 0) errs.push('Co-broker W-9 missing.');
  }
  if (form.deductions.referral === 'Yes') {
    if (form.documents.referralAgreement.length === 0) errs.push('Referral agreement missing.');
    if (form.documents.referralW9.length === 0) errs.push('Referral W-9 missing.');
  }
  return errs;
}

export function validateDeductions(form: FormData): string[] {
  const errs: string[] = [];
  const d = form.deductions;
  if (d.coBroker === 'Yes') {
    if (!d.coBrokerCompany.trim()) errs.push('Co-Broker Company is required.');
    if (num(d.coBrokerFeePercent) <= 0) errs.push('Co-Broker Fee % is required.');
    if (!d.coBrokerPaymentMethod) errs.push('Co-Broker payment method is required.');
  }
  if (d.referral === 'Yes') {
    if (!d.referrerName.trim()) errs.push('Referrer name is required.');
    if (num(d.referralFeePercent) <= 0) errs.push('Referral Fee % is required.');
    if (!d.referralPaymentMethod) errs.push('Referral payment method is required.');
  }
  errs.push(...conditionalDocErrors(form));
  return errs;
}

export function validateCommission(form: FormData): string[] {
  const errs: string[] = [];
  const c = form.commission;
  if (c.isHouseDeal === 'Yes' && !c.houseDealPrincipal) {
    errs.push('Select a house-deal principal.');
  }
  if (c.brokers.length === 0) errs.push('Add at least one broker.');
  for (const b of c.brokers) {
    if (!b.isHouseDealPrincipal && !b.profileId && !b.name.trim()) {
      errs.push('Every broker needs a profile or a name.');
      break;
    }
  }
  for (const b of c.brokers) {
    if (!b.isHouseDealPrincipal && !b.participantType) {
      errs.push('Every broker needs a participant type.');
      break;
    }
  }
  for (const b of c.brokers) {
    if (num(b.splitPercent) <= 0) {
      errs.push('Every broker needs a split %.');
      break;
    }
  }
  if (!splitsBalance(form)) {
    errs.push(`Splits must total 100% (currently ${brokerSplitTotal(form)}%).`);
  }
  if (!paymentsBalance(form)) {
    errs.push(
      `A/R payments (${paymentTotal(form)}) must equal Scheduled Commission (${num(
        form.dealDetails.scheduledCommission,
      )}).`,
    );
  }
  if (c.multiplePayments && c.paymentSchedule.some((p) => !p.dueDate)) {
    errs.push('Every payment needs a due date.');
  }
  return errs;
}

export const STEP_VALIDATORS = [
  validateDocuments,
  validateMetrics,
  validateDetails,
  validateParties,
  validateDeductions,
  validateCommission,
] as const;

/** Aggregate: is every step's validation clean? (Review submit gate.) */
export function allValid(form: FormData): boolean {
  return STEP_VALIDATORS.every((v) => v(form).length === 0);
}
