import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Resume-safety + snapshot semantics:
 *  - The Done Deal is created exactly once even when a LATER step fails and retries.
 *  - The snapshot Updates are non-fatal: a failing create_update never fails the submit.
 */
const calls: string[] = [];
let failSubitemOnce = true;
let failAllUpdates = false;

vi.mock('../monday/sdk', () => ({
  api: vi.fn(async (query: string) => {
    if (query.includes('create_update')) {
      calls.push('create_update');
      if (failAllUpdates) throw new Error('update boom');
      return { create_update: { id: 'u-1' } };
    }
    if (query.includes('create_subitem')) {
      calls.push('create_subitem');
      if (failSubitemOnce) {
        failSubitemOnce = false;
        throw new Error('sub boom');
      }
      return { create_subitem: { id: 'sub-1' } };
    }
    if (query.includes('create_item')) {
      calls.push('create_item');
      return { create_item: { id: 'dd-1' } };
    }
    calls.push('change_columns');
    return { change_multiple_column_values: { id: 'x' } };
  }),
  monday: {},
}));

import { runSubmission, INITIAL_SUBMIT_STATE } from './submit';
import { INITIAL_FORM_DATA, type FormData } from './types';

function deal(): FormData {
  const f = structuredClone(INITIAL_FORM_DATA);
  f.dealDetails.address = '500 Broadway';
  f.dealDetails.scheduledCommission = 100000;
  f.dealParties.sellers = [
    { id: 's1', name: 'Seller LLC', company: '', email: '', phone: '', entity: '' },
    { id: 's2', name: 'Extra LLC', company: '', email: '', phone: '', entity: '' },
  ];
  f.dealParties.buyers = [{ id: 'b1', name: 'Buyer LLC', company: '', email: '', phone: '', entity: '' }];
  f.commission.brokers = [
    { id: 'br1', profileId: '', name: 'Todd Cooper', participantType: 'Originator', splitPercent: '100' },
  ];
  f.commission.paymentSchedule = [{ id: 'p1', amount: 100000, dueDate: '' }];
  return f;
}

const ctx = { itemId: '123', userId: 1, profiles: [] };

describe('runSubmission resume', () => {
  beforeEach(() => {
    calls.length = 0;
    failSubitemOnce = true;
    failAllUpdates = false;
  });

  it('never re-creates the Done Deal when retrying a failed later step', async () => {
    const r1 = await runSubmission(ctx, deal(), { ...INITIAL_SUBMIT_STATE }, () => {});
    expect(r1.ok).toBe(false);
    expect(r1.failedStep).toBe(3); // participant subitems
    expect(r1.state.doneDealId).toBe('dd-1');
    expect(r1.state.completedSteps).toBe(2);

    const r2 = await runSubmission(ctx, deal(), r1.state, () => {});
    expect(r2.ok).toBe(true);

    // Done Deal create_item happens exactly once (before the first subitem attempt).
    const firstSub = calls.indexOf('create_subitem');
    expect(calls.slice(0, firstSub).filter((c) => c === 'create_item')).toHaveLength(1);
  });

  it('a failed snapshot update never fails the submit', async () => {
    failAllUpdates = true;
    failSubitemOnce = false; // everything else succeeds
    const r = await runSubmission(ctx, deal(), { ...INITIAL_SUBMIT_STATE }, () => {});
    expect(r.ok).toBe(true);
    expect(r.state.doneDealId).toBe('dd-1');
    expect(r.state.listingUpdateId).toBeNull();
    expect(r.state.doneDealUpdateId).toBeNull();
  });

  it('marks the winning lead closed (best-effort) when one is selected', async () => {
    failSubitemOnce = false;
    const form = deal();
    form.dealParties.winningLead = { id: 'L7', name: 'Kent Capital', offerPrice: 12000000, offerDate: '2026-06-01' };
    const r = await runSubmission(ctx, form, { ...INITIAL_SUBMIT_STATE }, () => {});
    expect(r.ok).toBe(true);
    expect(r.state.leadClosed).toBe(true);
    // No winning lead selected → no close attempted.
    const r2 = await runSubmission(ctx, deal(), { ...INITIAL_SUBMIT_STATE }, () => {});
    expect(r2.state.leadClosed).toBe(false);
  });
});
