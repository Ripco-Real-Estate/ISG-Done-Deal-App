import { monday } from '../monday/sdk';
import type { FormData } from './types';
import { INITIAL_FORM_DATA, makeParty } from './types';

/**
 * Draft autosave via monday Storage (instance-scoped). Source spec §5.
 * Best-effort: storage failures never break the wizard.
 */
const draftKey = (itemId: string) => `donedeal_draft_${itemId}`;

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Coerce any saved draft (including the legacy single seller/buyer shape) into
 * the current FormData shape. Missing keys default; legacy parties migrate.
 */
export function normalizeDraft(parsed: unknown): FormData {
  const base = structuredClone(INITIAL_FORM_DATA);
  const p = (parsed ?? {}) as Record<string, any>;
  const out: FormData = { ...base, ...p };

  const dp = p.dealParties;
  if (dp && Array.isArray(dp.sellers)) {
    out.dealParties = {
      sellers: dp.sellers.map((s: any, i: number) => ({ ...makeParty(s?.id ?? `seller-${i + 1}`), ...s })),
      buyers: (dp.buyers ?? []).map((b: any, i: number) => ({ ...makeParty(b?.id ?? `buyer-${i + 1}`), ...b })),
    };
    if (out.dealParties.sellers.length === 0) out.dealParties.sellers = [makeParty('seller-1')];
    if (out.dealParties.buyers.length === 0) out.dealParties.buyers = [makeParty('buyer-1')];
  } else if (dp) {
    out.dealParties = {
      sellers: [{ ...makeParty('seller-1'), ...(dp.seller ?? {}) }],
      buyers: [{ ...makeParty('buyer-1'), ...(dp.buyer ?? {}) }],
    };
  } else {
    out.dealParties = base.dealParties;
  }

  out.billing = { ...base.billing, ...(p.billing ?? {}) };
  out.commission = { ...base.commission, ...(p.commission ?? {}) };
  out.commission.paymentSchedule = (out.commission.paymentSchedule ?? []).map((r: any, i: number) => ({
    id: r?.id ?? `payment-${i + 1}`,
    amount: typeof r?.amount === 'number' ? r.amount : 0,
    dueDate: r?.dueDate ?? '',
  }));
  if (out.commission.paymentSchedule.length === 0) {
    out.commission.paymentSchedule = [{ id: 'payment-1', amount: 0, dueDate: '' }];
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function saveDraft(itemId: string, form: FormData): Promise<boolean> {
  try {
    await monday.storage.instance.setItem(draftKey(itemId), JSON.stringify(form));
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[storage] saveDraft failed', e);
    return false;
  }
}

export async function loadDraft(itemId: string): Promise<FormData | null> {
  try {
    const res = (await monday.storage.instance.getItem(draftKey(itemId))) as {
      data?: { value?: string | null };
    };
    const value = res?.data?.value;
    return value ? normalizeDraft(JSON.parse(value)) : null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[storage] loadDraft failed', e);
    return null;
  }
}

export async function clearDraft(itemId: string): Promise<void> {
  try {
    await monday.storage.instance.deleteItem(draftKey(itemId));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[storage] clearDraft failed', e);
  }
}
