import { describe, it, expect } from 'vitest';
import { normalizeDraft } from './storage';

describe('normalizeDraft', () => {
  it('migrates legacy {seller, buyer} drafts into arrays and fills new keys', () => {
    const legacy = {
      dealParties: {
        seller: { name: 'Old Seller LLC', company: 'OS Co', email: 's@x.com', phone: '1', entity: 'E' },
        buyer: { name: 'Old Buyer', company: 'OB Co', email: 'b@x.com' },
      },
      commission: {
        isHouseDeal: 'No',
        houseDealPrincipal: '',
        brokers: [],
        multiplePayments: false,
        paymentSchedule: [{ id: 'payment-1', amount: 500 }],
      },
    };
    const f = normalizeDraft(legacy);
    expect(f.dealParties.sellers[0].name).toBe('Old Seller LLC');
    expect(f.dealParties.sellers[0].entity).toBe('E');
    expect(f.dealParties.buyers[0].name).toBe('Old Buyer');
    expect(f.dealParties.buyers[0].phone).toBe('');
    expect(f.billing.sameAsSeller).toBe(true);
    expect(f.commission.paymentSchedule[0].dueDate).toBe('');
    expect(f.commission.paymentSchedule[0].amount).toBe(500);
    expect(f.documents.psa).toEqual([]);
  });

  it('passes new-shape drafts through intact', () => {
    const f1 = normalizeDraft({
      dealParties: {
        sellers: [{ id: 's1', name: 'New', company: '', email: '', phone: '', entity: '' }],
        buyers: [{ id: 'b1', name: 'NB', company: '', email: '', phone: '', entity: '' }],
      },
    });
    expect(f1.dealParties.sellers[0].name).toBe('New');
    expect(f1.dealParties.buyers).toHaveLength(1);
    expect(f1.dealParties.buyers[0].name).toBe('NB');
  });

  it('defaults an empty/garbage draft to the initial shape', () => {
    const f = normalizeDraft({});
    expect(f.dealParties.sellers).toHaveLength(1);
    expect(f.dealParties.buyers).toHaveLength(1);
    expect(f.commission.paymentSchedule).toHaveLength(1);
    expect(f.billing.sameAsSeller).toBe(true);
  });
});
