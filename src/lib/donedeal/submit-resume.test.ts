import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Resume-safety: step 2 creates the Done Deal AND posts the additional-parties
 * update. If the update fails, a retry must reuse the held doneDealId — the
 * Done Deal is created exactly once across both runs.
 */
const calls: string[] = [];
let failUpdateOnce = true;

vi.mock('../monday/sdk', () => ({
  api: vi.fn(async (query: string) => {
    if (query.includes('create_update')) {
      calls.push('create_update');
      if (failUpdateOnce) {
        failUpdateOnce = false;
        throw new Error('boom');
      }
      return { create_update: { id: 'u-1' } };
    }
    if (query.includes('create_subitem')) {
      calls.push('create_subitem');
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

function dealWithExtraSeller(): FormData {
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

describe('runSubmission resume', () => {
  beforeEach(() => {
    calls.length = 0;
    failUpdateOnce = true;
  });

  it('never re-creates the Done Deal when retrying a failed parties update', async () => {
    const ctx = { itemId: '123', userId: 1, profiles: [] };
    const form = dealWithExtraSeller();

    const r1 = await runSubmission(ctx, form, { ...INITIAL_SUBMIT_STATE }, () => {});
    expect(r1.ok).toBe(false);
    expect(r1.failedStep).toBe(2);
    expect(r1.state.doneDealId).toBe('dd-1');
    expect(r1.state.partiesUpdateId).toBeNull();

    const r2 = await runSubmission(ctx, form, r1.state, () => {});
    expect(r2.ok).toBe(true);
    expect(r2.state.partiesUpdateId).toBe('u-1');

    // Done Deal create happens exactly once across both runs (A/R creates come later).
    const firstSub = calls.indexOf('create_subitem');
    expect(calls.slice(0, firstSub).filter((c) => c === 'create_item')).toHaveLength(1);
    // Update attempted twice: failed once, succeeded once.
    expect(calls.filter((c) => c === 'create_update')).toHaveLength(2);
  });
});
