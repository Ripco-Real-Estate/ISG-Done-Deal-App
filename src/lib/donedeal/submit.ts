import { api } from '../monday/sdk';
import { BOARDS, ISG, DD, SUB, AR, DD_BILLING, AR_BILLING, LABELS, LEAD } from './columns';
import { buildContextSnapshot } from './snapshot';
import type { FormData, Profile } from './types';
import {
  computeWaterfall,
  computeTotalUnits,
  effectivePayments,
  num,
  primarySeller,
  primaryBuyer,
  resolvedBilling,
  type Waterfall,
} from './compute';

/**
 * The 5-step submission. Each step is a discrete async fn returning the ids it
 * created. `runSubmission` runs them sequentially, stops on the first failure,
 * NEVER rolls back, and can resume from the failed step (created ids are held in
 * `SubmitState` so a retry never double-creates). Source spec §9–§11.
 *
 * All column values are assembled by the pure `build*` helpers below and passed
 * to the API as a JSON-scalar *variable* — the SDK serializes once, so the
 * double-stringification gotcha from the Vibe build simply doesn't arise.
 *
 * Writes are VALUES ONLY. No structural mutations, ever.
 */

export interface SubmitCtx {
  itemId: string;
  userId: number | null;
  /** Active profiles, for matching the house-deal principal to a profile id. */
  profiles: Profile[];
}

export interface SubmitState {
  doneDealId: string | null;
  /** id of the snapshot Update posted on the ISG Listing (null = not posted / failed). */
  listingUpdateId: string | null;
  /** id of the snapshot Update posted on the Done Deal (null = not posted / failed). */
  doneDealUpdateId: string | null;
  subitemIds: string[];
  arItemIds: string[];
  /** Winning lead marked 'xx. Buyer' on the Leads Tracker (best-effort). */
  leadClosed: boolean;
  /** Highest step index fully completed (0 = nothing yet, 5 = all done). */
  completedSteps: number;
}

export const INITIAL_SUBMIT_STATE: SubmitState = {
  doneDealId: null,
  listingUpdateId: null,
  doneDealUpdateId: null,
  subitemIds: [],
  arItemIds: [],
  leadClosed: false,
  completedSteps: 0,
};

export type StepStatus = 'pending' | 'running' | 'done' | 'error';
export type ProgressCb = (step: number, message: string, status: StepStatus) => void;

/** Column-value primitives (monday JSON shapes). */
const statusLabel = (label: string) => ({ label });
const dropdownLabels = (label: string) => ({ labels: [label] });
const checkbox = (checked: boolean) => ({ checked: checked ? 'true' : 'false' });
const dateVal = (ymd: string) => ({ date: ymd });
const email = (addr: string) => ({ email: addr, text: addr });
const relation = (ids: Array<string | number>) => ({ item_ids: ids.map((i) => Number(i)) });
/**
 * Sanitize a phone field into a single valid US number for monday's phone column.
 * The source is often a comma/semicolon/slash-joined mirror of MULTIPLE contacts
 * (e.g. "2035075484, 2305550999") — sending that whole blob makes monday reject the
 * write. We take the FIRST candidate that resolves to a valid 10-digit US number
 * (or 11 digits with a leading country "1"), else return undefined so `prune` drops
 * the key and we simply write no phone rather than an invalid one.
 */
export function phoneVal(p: string): { phone: string; countryShortName: 'US' } | undefined {
  for (const candidate of (p ?? '').split(/[,;/|\n]+/)) {
    let digits = candidate.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
    if (digits.length === 10) return { phone: digits, countryShortName: 'US' };
  }
  return undefined;
}

/** Billing column payload for either board's billing block (prune drops empties). */
function billingCols(map: typeof DD_BILLING | typeof AR_BILLING, form: FormData): Record<string, unknown> {
  const b = resolvedBilling(form);
  return {
    [map.name]: b.name,
    [map.company]: b.company,
    [map.address]: b.address,
    [map.phone]: b.phone ? phoneVal(b.phone) : undefined,
    [map.email1]: b.email1,
    [map.email2]: b.email2,
    [map.email3]: b.email3,
    [map.email4]: b.email4,
  };
}

/** Drop undefined/null/'' keys; keep 0 and false (they're meaningful). */
export function prune<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
}

const todayYmd = (now: Date) => now.toISOString().slice(0, 10);

// ── Step 1: ISG Listings update ─────────────────────────────────────────────
export function buildListingUpdate(form: FormData, wf: Waterfall): Record<string, unknown> {
  const d = form.dealDetails;
  const m = form.metrics;
  const dd = form.deductions;
  const cols: Record<string, unknown> = {
    [ISG.dealStage]: statusLabel('xx. Done Deal'),
    [ISG.dealStatus]: statusLabel('Done Deal'),
    [ISG.sentToFinance]: statusLabel('Submitted'),
    [ISG.finalSalesPrice]: num(d.finalSalesPrice),
    [ISG.scheduledCommission]: num(d.scheduledCommission),
    [ISG.transactionSummary]: d.transactionSummary,
    [ISG.transactionType]: d.transactionType ? dropdownLabels(d.transactionType) : undefined,
    [ISG.sourceType]: d.sourceType ? dropdownLabels(d.sourceType) : undefined,
    [ISG.coBroker]: dropdownLabels(dd.coBroker),
    [ISG.referral]: dropdownLabels(dd.referral),
    [ISG.capRate]: m.capRate ?? undefined,
    [ISG.resiUnits]: m.resiUnits,
    [ISG.commUnits]: m.commUnits ?? undefined,
    [ISG.totalUnits]: computeTotalUnits(form) || undefined,
    [ISG.buyerName]: primaryBuyer(form).name,
    [ISG.buyerCompany]: primaryBuyer(form).company,
    [ISG.buyerEmail]: primaryBuyer(form).email,
    [ISG.houseDeal]: statusLabel(form.commission.isHouseDeal),
    [ISG.netToRipco]: wf.netToRipco,
    [ISG.concessions]: wf.concessions,
  };
  if (d.contractPrice) cols[ISG.contractPrice] = num(d.contractPrice);
  if (d.actualCloseDate) cols[ISG.actualCloseDate] = dateVal(d.actualCloseDate);
  // Deduction detail — only when the toggle is on.
  if (dd.coBroker === 'Yes') {
    cols[ISG.coBrokerCo] = dd.coBrokerCompany;
    cols[ISG.coBrokerPercentText] = dd.coBrokerFeePercent;
    cols[ISG.coBrokerFeeDollars] = wf.coBrokerFee;
    cols[ISG.coBrokerPaidDirectly] = checkbox(dd.coBrokerPaymentMethod === 'paid_at_closing');
  }
  if (dd.referral === 'Yes') {
    cols[ISG.referralCo] = dd.referrerName;
    cols[ISG.referralPercentText] = dd.referralFeePercent;
    cols[ISG.referralFeeDollars] = wf.referralFee;
    cols[ISG.referralPaidDirectly] = checkbox(dd.referralPaymentMethod === 'paid_at_closing');
  }
  return prune(cols);
}

async function updateListing(ctx: SubmitCtx, form: FormData, wf: Waterfall): Promise<void> {
  const cols = buildListingUpdate(form, wf);
  const mutation = `
    mutation UpdateListing($board: ID!, $item: ID!, $cols: JSON!) {
      change_multiple_column_values(board_id: $board, item_id: $item, column_values: $cols) { id }
    }`;
  await api(mutation, { board: BOARDS.isgListings, item: ctx.itemId, cols: JSON.stringify(cols) });
}

// ── Step 2: create Done Deal ────────────────────────────────────────────────
export function buildDoneDeal(
  form: FormData,
  wf: Waterfall,
  ctx: SubmitCtx,
  now: Date,
): { itemName: string; cols: Record<string, unknown> } {
  const d = form.dealDetails;
  const seller = primarySeller(form);
  const buyer = primaryBuyer(form);
  const dd = form.deductions;
  const cols: Record<string, unknown> = {
    [DD.propertyAddress]: d.address,
    [DD.transactionType]: d.transactionType,
    [DD.sellerName]: seller.name,
    [DD.sellerCompany]: seller.company,
    [DD.buyerName]: buyer.name,
    [DD.buyerCompany]: buyer.company,
    [DD.saleLoanAmount]: num(d.finalSalesPrice),
    [DD.fullCommission]: wf.fullCommission,
    [DD.grossCommission]: wf.grossCommission,
    [DD.netToRipco]: wf.netToRipco,
    [DD.concessions]: wf.concessions,
    [DD.financeStatus]: statusLabel(LABELS.financeNewSubmission),
    [DD.coBroker]: statusLabel(dd.coBroker),
    [DD.referral]: statusLabel(dd.referral),
    [DD.houseDeal]: statusLabel(form.commission.isHouseDeal),
    [DD.submissionDate]: dateVal(todayYmd(now)),
    [DD.sourceType]: d.sourceType ? dropdownLabels(d.sourceType) : undefined,
    [DD.dealNotes]: form.dealNotes || d.transactionSummary,
  };
  if (d.actualCloseDate) cols[DD.closedDate] = dateVal(d.actualCloseDate);
  if (seller.email) cols[DD.sellerEmail] = email(seller.email);
  if (buyer.email) cols[DD.buyerEmail] = email(buyer.email);
  if (ctx.userId) cols[DD.submittedBy] = { personsAndTeams: [{ id: ctx.userId, kind: 'person' }] };
  cols[DD.sourceDealLink] = relation([ctx.itemId]);
  // Deduction detail
  if (dd.coBroker === 'Yes') {
    cols[DD.coBrokerCo] = dd.coBrokerCompany;
    cols[DD.coBrokerFeePercent] = num(dd.coBrokerFeePercent);
    cols[DD.coBrokerFeeDollars] = wf.coBrokerFee;
    cols[DD.coBrokerPaidDirectly] = checkbox(dd.coBrokerPaymentMethod === 'paid_at_closing');
  }
  if (dd.referral === 'Yes') {
    cols[DD.referrerCo] = dd.referrerName;
    cols[DD.referralFeePercent] = num(dd.referralFeePercent);
    cols[DD.referralFeeDollars] = wf.referralFee;
    cols[DD.referralPaidDirectly] = checkbox(dd.referralPaymentMethod === 'paid_at_closing');
  }
  Object.assign(cols, billingCols(DD_BILLING, form));
  const itemName = d.address || seller.name || 'Done Deal';
  return { itemName, cols: prune(cols) };
}

async function postUpdate(itemId: string, body: string): Promise<string> {
  const mutation = `
    mutation PostUpdate($item: ID!, $body: String!) {
      create_update(item_id: $item, body: $body) { id }
    }`;
  const data = await api<{ create_update: { id: string } }>(mutation, { item: itemId, body });
  return data.create_update.id;
}

/**
 * Post the snapshot Update, swallowing any failure. The structured column writes are
 * the system of record; this Update is a convenience snapshot and must NEVER fail the
 * submit (a failed Update after the Done Deal exists would otherwise strand the user).
 */
async function postUpdateSafe(itemId: string, body: string): Promise<string | null> {
  try {
    return await postUpdate(itemId, body);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[submit] snapshot update failed (non-fatal)', e);
    return null;
  }
}

/**
 * Close the funnel loop: mark the chosen lead 'xx. Buyer' on the ISG Leads Tracker.
 * Values only (the label exists on the live board) and best-effort — a Leads write
 * must never block a Finance submit. Losing leads are intentionally untouched
 * (handled later by board automation once the funnel process is finalized).
 */
async function closeWinningLeadSafe(leadId: string): Promise<boolean> {
  try {
    const mutation = `
      mutation CloseLead($board: ID!, $item: ID!, $cols: JSON!) {
        change_multiple_column_values(board_id: $board, item_id: $item, column_values: $cols) { id }
      }`;
    await api(mutation, {
      board: BOARDS.leadsTracker,
      item: leadId,
      cols: JSON.stringify({ [LEAD.status]: statusLabel(LABELS.leadWinner) }),
    });
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[submit] winning-lead close failed (non-fatal)', e);
    return false;
  }
}

async function createDoneDeal(ctx: SubmitCtx, form: FormData, wf: Waterfall, now: Date): Promise<string> {
  const { itemName, cols } = buildDoneDeal(form, wf, ctx, now);
  const mutation = `
    mutation CreateDoneDeal($board: ID!, $group: String, $name: String!, $cols: JSON!) {
      create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $cols) { id }
    }`;
  const data = await api<{ create_item: { id: string } }>(mutation, {
    board: BOARDS.doneDeals,
    group: 'topics',
    name: itemName,
    cols: JSON.stringify(cols),
  });
  return data.create_item.id;
}

// ── Step 3: participant subitems ────────────────────────────────────────────
export function buildSubitem(
  form: FormData,
  broker: FormData['commission']['brokers'][number],
  ctx: SubmitCtx,
): { name: string; cols: Record<string, unknown> } {
  const isHouse = !!broker.isHouseDealPrincipal;
  const profile = ctx.profiles.find((p) => p.id === broker.profileId);
  const name = profile?.name || broker.name || 'Participant';
  const cols: Record<string, unknown> = {
    [SUB.participantType]: statusLabel(
      isHouse ? LABELS.participantOriginator : broker.participantType || LABELS.participantTeamMember,
    ),
    [SUB.splitType]: statusLabel(isHouse ? LABELS.splitHouseDeal : LABELS.splitTeamSplit),
    [SUB.splitPercent]: num(broker.splitPercent),
    [SUB.receivesOriginationCredit]: checkbox(!isHouse),
  };
  if (broker.profileId) cols[SUB.brokerProfilesLink] = relation([broker.profileId]);
  return { name, cols: prune(cols) };
}

async function createSubitems(
  ctx: SubmitCtx,
  form: FormData,
  doneDealId: string,
  existing: string[],
): Promise<string[]> {
  const ids = [...existing];
  const mutation = `
    mutation CreateSub($parent: ID!, $name: String!, $cols: JSON!) {
      create_subitem(parent_item_id: $parent, item_name: $name, column_values: $cols) { id }
    }`;
  // Resume-safe: only create the brokers we haven't created yet.
  for (let i = existing.length; i < form.commission.brokers.length; i++) {
    const { name, cols } = buildSubitem(form, form.commission.brokers[i], ctx);
    const data = await api<{ create_subitem: { id: string } }>(mutation, {
      parent: doneDealId,
      name,
      cols: JSON.stringify(cols),
    });
    ids.push(data.create_subitem.id);
  }
  return ids;
}

// ── Step 4: A/R schedule items ──────────────────────────────────────────────
export function buildArItem(
  form: FormData,
  paymentIndex: number,
  doneDealId: string,
): { name: string; cols: Record<string, unknown> } {
  const rows = effectivePayments(form);
  const row = rows[paymentIndex];
  const total = rows.length;
  const n = paymentIndex + 1;
  const address = form.dealDetails.address || 'Deal';
  const cols: Record<string, unknown> = {
    [AR.paymentNumber]: n,
    [AR.scheduledAmount]: num(row.amount),
    [AR.clientName]: primarySeller(form).name,
    [AR.tenantBuyerBorrower]: primaryBuyer(form).name,
    [AR.doneDealRelation]: relation([doneDealId]),
    [AR.sourceType]: form.dealDetails.sourceType ? dropdownLabels(form.dealDetails.sourceType) : undefined,
  };
  // Optional per-row due date; single payment falls back to the close date.
  const due = row.dueDate || form.dealDetails.actualCloseDate;
  if (due) cols[AR.dueDate] = dateVal(due);
  // Billing rides on every A/R item — Finance invoices from this board.
  Object.assign(cols, billingCols(AR_BILLING, form));
  return { name: `${address} — Payment ${n} of ${total}`, cols: prune(cols) };
}

async function createArItems(
  form: FormData,
  doneDealId: string,
  existing: string[],
): Promise<string[]> {
  const ids = [...existing];
  const mutation = `
    mutation CreateAr($board: ID!, $group: String, $name: String!, $cols: JSON!) {
      create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $cols) { id }
    }`;
  for (let i = existing.length; i < effectivePayments(form).length; i++) {
    const { name, cols } = buildArItem(form, i, doneDealId);
    const data = await api<{ create_item: { id: string } }>(mutation, {
      board: BOARDS.arSchedules,
      group: 'topics',
      name,
      cols: JSON.stringify(cols),
    });
    ids.push(data.create_item.id);
  }
  return ids;
}

// ── Step 5: link A/R items back to the Done Deal ────────────────────────────
async function linkArToDoneDeal(doneDealId: string, arItemIds: string[]): Promise<void> {
  const cols = { [DD.arRelation]: relation(arItemIds) };
  const mutation = `
    mutation LinkAr($board: ID!, $item: ID!, $cols: JSON!) {
      change_multiple_column_values(board_id: $board, item_id: $item, column_values: $cols) { id }
    }`;
  await api(mutation, { board: BOARDS.doneDeals, item: doneDealId, cols: JSON.stringify(cols) });
}

/** Human-readable failure messages per step (source spec §10.2). */
export const STEP_FAILURE_MSG: Record<number, (s: SubmitState) => string> = {
  1: () => 'Failed to update listing record. Please try again.',
  2: () => 'Listing updated but Done Deal creation failed. Please try again.',
  3: (s) =>
    `Done Deal created (ID: ${s.doneDealId}) but commission participants failed. Click Retry to attempt participants again. You can also contact Adrian with Deal ID ${s.doneDealId}.`,
  4: (s) =>
    `Done Deal and participants created, but A/R schedule failed. Click Retry for A/R only. (Deal ID ${s.doneDealId})`,
  5: (s) => `All records created but linking failed. Contact Adrian with Deal ID ${s.doneDealId}.`,
};

export const STEP_LABELS = [
  'Update listing record',
  'Create Done Deal',
  'Create commission participants',
  'Create A/R schedule',
  'Link A/R + finalize',
] as const;

export interface SubmitResult {
  ok: boolean;
  state: SubmitState;
  failedStep?: number;
  error?: string;
}

/**
 * Run the sequence, resuming from `state.completedSteps`. `now` is injected so
 * the submission is deterministic/testable (no hidden Date.now()).
 */
export async function runSubmission(
  ctx: SubmitCtx,
  form: FormData,
  state: SubmitState,
  onProgress: ProgressCb,
  now: Date = new Date(),
  clearDraftFn?: () => Promise<void>,
): Promise<SubmitResult> {
  const wf = computeWaterfall(form);
  const snapshot = buildContextSnapshot(form, wf);
  const s: SubmitState = { ...state, subitemIds: [...state.subitemIds], arItemIds: [...state.arItemIds] };

  try {
    if (s.completedSteps < 1) {
      onProgress(1, STEP_LABELS[0], 'running');
      await updateListing(ctx, form, wf);
      // Best-effort snapshot on the listing (never fails the submit).
      if (!s.listingUpdateId) s.listingUpdateId = await postUpdateSafe(ctx.itemId, snapshot);
      s.completedSteps = 1;
      onProgress(1, STEP_LABELS[0], 'done');
    }
    if (s.completedSteps < 2) {
      onProgress(2, STEP_LABELS[1], 'running');
      // Resume-safe: held doneDealId means a retry never re-creates the item.
      if (!s.doneDealId) s.doneDealId = await createDoneDeal(ctx, form, wf, now);
      // Best-effort snapshot on the Done Deal (never fails the submit).
      if (!s.doneDealUpdateId) s.doneDealUpdateId = await postUpdateSafe(s.doneDealId, snapshot);
      // Best-effort funnel close: winning lead → 'xx. Buyer'.
      const lead = form.dealParties.winningLead;
      if (lead && !s.leadClosed) s.leadClosed = await closeWinningLeadSafe(lead.id);
      s.completedSteps = 2;
      onProgress(2, STEP_LABELS[1], 'done');
    }
    if (s.completedSteps < 3) {
      onProgress(3, STEP_LABELS[2], 'running');
      s.subitemIds = await createSubitems(ctx, form, s.doneDealId!, s.subitemIds);
      s.completedSteps = 3;
      onProgress(3, STEP_LABELS[2], 'done');
    }
    if (s.completedSteps < 4) {
      onProgress(4, STEP_LABELS[3], 'running');
      s.arItemIds = await createArItems(form, s.doneDealId!, s.arItemIds);
      s.completedSteps = 4;
      onProgress(4, STEP_LABELS[3], 'done');
    }
    if (s.completedSteps < 5) {
      onProgress(5, STEP_LABELS[4], 'running');
      await linkArToDoneDeal(s.doneDealId!, s.arItemIds);
      s.completedSteps = 5;
      onProgress(5, STEP_LABELS[4], 'done');
    }
    if (clearDraftFn) await clearDraftFn();
    return { ok: true, state: s };
  } catch (err) {
    const failedStep = s.completedSteps + 1;
    const msg = STEP_FAILURE_MSG[failedStep]?.(s) ?? (err as Error).message;
    onProgress(failedStep, STEP_LABELS[failedStep - 1], 'error');
    // eslint-disable-next-line no-console
    console.error(`[submit] step ${failedStep} failed`, err);
    return { ok: false, state: s, failedStep, error: msg };
  }
}
