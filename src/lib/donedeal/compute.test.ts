import { describe, it, expect } from 'vitest';
import {
  computeWaterfall,
  computePPSF,
  computeTotalUnits,
  brokerSplitTotal,
  splitsBalance,
  effectivePayments,
  paymentTotal,
  paymentsBalance,
  validateDocuments,
  validateDetails,
  validateParties,
  validateDeductions,
  validateCommission,
  resolvedBilling,
  conditionalDocErrors,
  allValid,
} from './compute';
import { INITIAL_FORM_DATA, type FormData } from './types';
import { HOUSE_DEAL_SPLIT, HOUSE_DEAL_REMAINDER } from './columns';

function base(overrides: (f: FormData) => void): FormData {
  const f = structuredClone(INITIAL_FORM_DATA);
  overrides(f);
  return f;
}

describe('computeWaterfall', () => {
  it('passes full commission straight through with no deductions', () => {
    const f = base((f) => (f.dealDetails.scheduledCommission = 100000));
    const wf = computeWaterfall(f);
    expect(wf.fullCommission).toBe(100000);
    expect(wf.coBrokerFee).toBe(0);
    expect(wf.netToRipco).toBe(100000);
    expect(wf.grossCommission).toBe(100000);
  });

  it('subtracts co-broker fee from full commission to get net', () => {
    const f = base((f) => {
      f.dealDetails.scheduledCommission = 100000;
      f.deductions.coBroker = 'Yes';
      f.deductions.coBrokerFeePercent = '25';
    });
    const wf = computeWaterfall(f);
    expect(wf.coBrokerFee).toBe(25000);
    expect(wf.netToRipco).toBe(75000);
  });

  it('applies referral against NET to ripco, then concessions', () => {
    const f = base((f) => {
      f.dealDetails.scheduledCommission = 100000;
      f.deductions.coBroker = 'Yes';
      f.deductions.coBrokerFeePercent = '20'; // 20k → net 80k
      f.deductions.referral = 'Yes';
      f.deductions.referralFeePercent = '10'; // 10% of 80k = 8k
      f.deductions.concessions = 2000;
    });
    const wf = computeWaterfall(f);
    expect(wf.coBrokerFee).toBe(20000);
    expect(wf.netToRipco).toBe(80000);
    expect(wf.referralFee).toBe(8000);
    expect(wf.grossCommission).toBe(70000); // 80k - 8k - 2k
  });

  it('ignores fees when the toggle is No even if a percent lingers', () => {
    const f = base((f) => {
      f.dealDetails.scheduledCommission = 50000;
      f.deductions.coBroker = 'No';
      f.deductions.coBrokerFeePercent = '30';
    });
    expect(computeWaterfall(f).coBrokerFee).toBe(0);
  });
});

describe('metrics', () => {
  it('computes PPSF and guards divide-by-zero', () => {
    const f = base((f) => {
      f.dealDetails.finalSalesPrice = 1000000;
      f.metrics.totalSf = 5000;
    });
    expect(computePPSF(f)).toBe(200);
    expect(computePPSF(base((f) => (f.metrics.totalSf = 0)))).toBe(0);
  });

  it('sums resi + comm when total not set', () => {
    const f = base((f) => {
      f.metrics.resiUnits = '10';
      f.metrics.commUnits = 3;
      f.metrics.totalUnits = null;
    });
    expect(computeTotalUnits(f)).toBe(13);
  });

  it('prefers an explicit total units', () => {
    const f = base((f) => {
      f.metrics.resiUnits = '10';
      f.metrics.commUnits = 3;
      f.metrics.totalUnits = 20;
    });
    expect(computeTotalUnits(f)).toBe(20);
  });
});

describe('splits', () => {
  it('non-house: brokers must total 100', () => {
    const f = base((f) => {
      f.commission.brokers = [
        { id: 'a', profileId: '1', name: 'A', participantType: 'Originator', splitPercent: '60' },
        { id: 'b', profileId: '2', name: 'B', participantType: 'Team Member', splitPercent: '40' },
      ];
    });
    expect(brokerSplitTotal(f)).toBe(100);
    expect(splitsBalance(f)).toBe(true);
  });

  it('house deal: principal 16.66 + brokers 83.34 = 100', () => {
    const f = base((f) => {
      f.commission.isHouseDeal = 'Yes';
      f.commission.houseDealPrincipal = 'Todd Cooper';
      f.commission.brokers = [
        { id: 'p', profileId: '', name: 'Todd Cooper', participantType: 'Originator', splitPercent: String(HOUSE_DEAL_SPLIT), isHouseDealPrincipal: true },
        { id: 'a', profileId: '1', name: 'A', participantType: 'Team Member', splitPercent: String(HOUSE_DEAL_REMAINDER) },
      ];
    });
    expect(brokerSplitTotal(f)).toBe(100);
    expect(splitsBalance(f)).toBe(true);
  });

  it('flags an unbalanced split', () => {
    const f = base((f) => {
      f.commission.brokers = [
        { id: 'a', profileId: '1', name: 'A', participantType: 'Originator', splitPercent: '70' },
      ];
    });
    expect(splitsBalance(f)).toBe(false);
  });
});

describe('A/R payments', () => {
  it('balances when rows sum to scheduled commission', () => {
    const f = base((f) => {
      f.dealDetails.scheduledCommission = 90000;
      f.commission.multiplePayments = true;
      f.commission.paymentSchedule = [
        { id: '1', amount: 45000, dueDate: '2026-07-15' },
        { id: '2', amount: 45000, dueDate: '2026-08-15' },
      ];
    });
    expect(paymentTotal(f)).toBe(90000);
    expect(paymentsBalance(f)).toBe(true);
  });

  it('fails when rows do not equal scheduled commission', () => {
    const f = base((f) => {
      f.dealDetails.scheduledCommission = 90000;
      f.commission.multiplePayments = true;
      f.commission.paymentSchedule = [{ id: '1', amount: 80000, dueDate: '2026-07-15' }];
    });
    expect(paymentsBalance(f)).toBe(false);
  });
});

describe('billing', () => {
  it('derives name/company/phone/email1 from primary seller while sameAsSeller', () => {
    const f = base((f) => {
      f.dealParties.sellers = [
        { id: 's1', name: 'Jane Roe', company: 'BH LLC', email: 'j@bh.com', phone: '917', entity: '' },
      ];
      f.billing.sameAsSeller = true;
      f.billing.address = '1 Main St';
    });
    expect(resolvedBilling(f)).toMatchObject({
      name: 'Jane Roe',
      company: 'BH LLC',
      email1: 'j@bh.com',
      phone: '917',
      address: '1 Main St',
    });
  });

  it('requires name, company, address, phone, email1 via validateParties', () => {
    const f = base((f) => {
      f.dealParties.sellers = [{ id: 's1', name: 'S', company: '', email: '', phone: '', entity: '' }];
      f.dealParties.buyers = [{ id: 'b1', name: 'B', company: '', email: '', phone: '', entity: '' }];
      f.billing = { sameAsSeller: false, name: '', company: '', address: '', phone: '',
        email1: '', email2: '', email3: '', email4: '' };
    });
    expect(validateParties(f)).toEqual(
      expect.arrayContaining([
        'Billing contact name is required.',
        'Billing contact company is required.',
        'Billing address is required.',
        'Billing phone is required.',
        'Billing email 1 is required.',
      ]),
    );
  });
});

describe('effectivePayments', () => {
  it('derives the single payment from Scheduled Commission (never a stale copy)', () => {
    const f = base((f) => {
      f.dealDetails.scheduledCommission = 250000;
      f.commission.multiplePayments = false;
      f.commission.paymentSchedule = [{ id: 'p1', amount: 99, dueDate: '2026-08-01' }];
    });
    expect(effectivePayments(f)).toEqual([{ id: 'p1', amount: 250000, dueDate: '2026-08-01' }]);
    expect(paymentTotal(f)).toBe(250000);
    expect(paymentsBalance(f)).toBe(true);
  });

  it('requires a due date on every row only when multiple payments', () => {
    const f = base((f) => {
      f.dealDetails.scheduledCommission = 100;
      f.commission.brokers = [
        { id: 'b', profileId: '', name: 'X', participantType: 'Originator', splitPercent: '100' },
      ];
      f.commission.multiplePayments = true;
      f.commission.paymentSchedule = [
        { id: 'p1', amount: 50, dueDate: '2026-08-01' },
        { id: 'p2', amount: 50, dueDate: '' },
      ];
    });
    expect(validateCommission(f)).toContain('Every payment needs a due date.');
    f.commission.paymentSchedule[1].dueDate = '2026-09-01';
    expect(validateCommission(f)).not.toContain('Every payment needs a due date.');
  });
});

describe('validation gates', () => {
  it('documents require PSA + EA', () => {
    expect(validateDocuments(INITIAL_FORM_DATA)).toHaveLength(2);
    const f = base((f) => {
      f.documents.psa = [{ name: 'psa.pdf' }];
      f.documents.exclusiveAgreement = [{ name: 'ea.pdf' }];
    });
    expect(validateDocuments(f)).toHaveLength(0);
  });

  it('details require the core financial fields', () => {
    const f = base((f) => {
      f.dealDetails.address = '123 Main St';
      f.dealDetails.transactionType = 'Sale';
      f.dealDetails.finalSalesPrice = 1000000;
      f.dealDetails.scheduledCommission = 50000;
      f.dealDetails.baseRate = 5;
      f.dealDetails.actualCloseDate = '2026-07-01';
    });
    expect(validateDetails(f)).toHaveLength(0);
    expect(validateDetails(base((f) => (f.dealDetails.address = ''))).length).toBeGreaterThan(0);
  });

  it('commission requires balanced splits and payments', () => {
    const f = base((f) => {
      f.dealDetails.scheduledCommission = 100000;
      f.commission.brokers = [
        { id: 'a', profileId: '1', name: 'A', participantType: 'Originator', splitPercent: '100' },
      ];
      f.commission.paymentSchedule = [{ id: '1', amount: 100000, dueDate: '' }];
    });
    expect(validateCommission(f)).toHaveLength(0);
  });

  it('requires co-broker agreement + W-9 only when co-broker is Yes, via validateDeductions', () => {
    const f = base((f) => {
      f.deductions.coBroker = 'Yes';
      f.deductions.coBrokerCompany = 'ACME';
      f.deductions.coBrokerFeePercent = '20';
      f.deductions.coBrokerPaymentMethod = 'paid_at_closing';
    });
    expect(validateDeductions(f)).toEqual(
      expect.arrayContaining(['Co-broker agreement missing.', 'Co-broker W-9 missing.']),
    );
    f.documents.coBrokerAgreement = [{ name: 'cb.pdf' }];
    f.documents.coBrokerW9 = [{ name: 'w9.pdf' }];
    expect(conditionalDocErrors(f)).toEqual([]);
    expect(validateDeductions(f)).toEqual([]);
  });

  it('requires referral agreement + W-9 only when referral is Yes', () => {
    const f = base((f) => {
      f.deductions.referral = 'Yes';
    });
    expect(conditionalDocErrors(f)).toEqual(['Referral agreement missing.', 'Referral W-9 missing.']);
    expect(conditionalDocErrors(base(() => {}))).toEqual([]);
  });
});

describe('allValid', () => {
  it('is true only for a fully-complete form', () => {
    const f = base((f) => {
      f.documents.psa = [{ name: 'psa.pdf' }];
      f.documents.exclusiveAgreement = [{ name: 'ea.pdf' }];
      f.dealDetails.address = '123 Main St';
      f.dealDetails.transactionType = 'Sale';
      f.dealDetails.finalSalesPrice = 1000000;
      f.dealDetails.scheduledCommission = 100000;
      f.dealDetails.baseRate = 5;
      f.dealDetails.actualCloseDate = '2026-07-01';
      f.dealParties.sellers = [{ id: 's1', name: 'Seller LLC', company: '', email: '', phone: '', entity: '' }];
      f.dealParties.buyers = [{ id: 'b1', name: 'Buyer LLC', company: '', email: '', phone: '', entity: '' }];
      f.billing = { sameAsSeller: false, name: 'AP', company: 'Seller LLC', address: '1 Main St',
        phone: '212', email1: 'ap@s.com', email2: '', email3: '', email4: '' };
      f.commission.brokers = [
        { id: 'a', profileId: '1', name: 'A', participantType: 'Originator', splitPercent: '100' },
      ];
      f.commission.paymentSchedule = [{ id: '1', amount: 100000, dueDate: '' }];
    });
    expect(allValid(f)).toBe(true);
    expect(allValid(base(() => {}))).toBe(false);
  });
});
