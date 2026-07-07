import { describe, it, expect } from 'vitest';
import { buildListingUpdate, buildDoneDeal, buildSubitem, buildArItem, buildPartiesUpdate, prune } from './submit';
import type { SubmitCtx } from './submit';
import { computeWaterfall } from './compute';
import { INITIAL_FORM_DATA, type FormData } from './types';
import { ISG, DD, SUB, AR, DD_BILLING, AR_BILLING } from './columns';

function fullDeal(): FormData {
  const f = structuredClone(INITIAL_FORM_DATA);
  f.dealDetails.address = '500 Broadway';
  f.dealDetails.transactionType = 'Sale';
  f.dealDetails.sourceType = 'iSales-Seller Rep';
  f.dealDetails.finalSalesPrice = 2000000;
  f.dealDetails.scheduledCommission = 100000;
  f.dealDetails.actualCloseDate = '2026-07-01';
  f.dealParties.sellers = [
    { id: 's1', name: 'Seller LLC', company: '', email: 'seller@example.com', phone: '', entity: '' },
  ];
  f.dealParties.buyers = [{ id: 'b1', name: 'Buyer LLC', company: '', email: '', phone: '', entity: '' }];
  f.deductions.coBroker = 'Yes';
  f.deductions.coBrokerCompany = 'ACME';
  f.deductions.coBrokerFeePercent = '20';
  f.deductions.coBrokerPaymentMethod = 'paid_at_closing';
  f.commission.paymentSchedule = [{ id: '1', amount: 100000, dueDate: '2026-07-15' }];
  return f;
}

const ctx: SubmitCtx = { itemId: '123', userId: 77, profiles: [{ id: '900', name: 'Todd Cooper', active: true, userIds: [] }] };

describe('prune', () => {
  it('drops undefined/null/empty but keeps 0 and false', () => {
    expect(prune({ a: 0, b: false, c: '', d: null, e: undefined, f: 'x' })).toEqual({ a: 0, b: false, f: 'x' });
  });
});

describe('buildListingUpdate', () => {
  it('sets the three status columns to finalize the listing', () => {
    const f = fullDeal();
    const cols = buildListingUpdate(f, computeWaterfall(f));
    expect(cols[ISG.dealStage]).toEqual({ label: 'xx. Done Deal' });
    expect(cols[ISG.dealStatus]).toEqual({ label: 'Done Deal' });
    expect(cols[ISG.sentToFinance]).toEqual({ label: 'Submitted' });
  });

  it('writes dropdowns by LABEL, not id', () => {
    const f = fullDeal();
    const cols = buildListingUpdate(f, computeWaterfall(f));
    expect(cols[ISG.transactionType]).toEqual({ labels: ['Sale'] });
    expect(cols[ISG.coBroker]).toEqual({ labels: ['Yes'] });
  });

  it('includes co-broker detail only when co-broker is Yes', () => {
    const f = fullDeal();
    const cols = buildListingUpdate(f, computeWaterfall(f));
    expect(cols[ISG.coBrokerCo]).toBe('ACME');
    expect(cols[ISG.coBrokerFeeDollars]).toBe(20000);
    expect(cols[ISG.coBrokerPaidDirectly]).toEqual({ checked: 'true' });
    const noCoBroker = structuredClone(f);
    noCoBroker.deductions.coBroker = 'No';
    const cols2 = buildListingUpdate(noCoBroker, computeWaterfall(noCoBroker));
    expect(cols2[ISG.coBrokerCo]).toBeUndefined();
  });
});

describe('buildDoneDeal', () => {
  it('uses the CORRECTED column ids', () => {
    const f = fullDeal();
    const { cols, itemName } = buildDoneDeal(f, computeWaterfall(f), ctx, new Date('2026-07-06T12:00:00Z'));
    expect(itemName).toBe('500 Broadway');
    // Transaction Type → text_mm1agpza (NOT text_mkzwdpqx)
    expect(cols[DD.transactionType]).toBe('Sale');
    expect(DD.transactionType).toBe('text_mm1agpza');
    // Seller name → text_mkzwvxbw (NOT text_mkzwgdt4)
    expect(cols[DD.sellerName]).toBe('Seller LLC');
    expect(DD.sellerName).toBe('text_mkzwvxbw');
    // Gross Commission → numeric_mkzwm946, Net to RIPCO → numeric_mkzw6wzk
    expect(DD.grossCommission).toBe('numeric_mkzwm946');
    expect(DD.netToRipco).toBe('numeric_mkzw6wzk');
    // Source deal link back to the ISG listing
    expect(cols[DD.sourceDealLink]).toEqual({ item_ids: [123] });
    // Submission status + date
    expect(cols[DD.financeStatus]).toEqual({ label: 'New Submission' });
    expect(cols[DD.submissionDate]).toEqual({ date: '2026-07-06' });
    // Submitted-by carries the current user
    expect(cols[DD.submittedBy]).toEqual({ personsAndTeams: [{ id: 77, kind: 'person' }] });
  });
});

describe('buildSubitem', () => {
  it('house-deal principal: House Deal split, no origination credit, links profile', () => {
    const f = fullDeal();
    const broker = { id: 'p', profileId: '900', name: 'Todd Cooper', participantType: 'Originator' as const, splitPercent: '16.66', isHouseDealPrincipal: true };
    const { name, cols } = buildSubitem(f, broker, ctx);
    expect(name).toBe('Todd Cooper');
    expect(cols[SUB.splitType]).toEqual({ label: 'House Deal' });
    expect(cols[SUB.receivesOriginationCredit]).toEqual({ checked: 'false' });
    expect(cols[SUB.brokerProfilesLink]).toEqual({ item_ids: [900] });
    expect(cols[SUB.splitPercent]).toBe(16.66);
  });

  it('regular broker: Team Split with origination credit', () => {
    const f = fullDeal();
    const broker = { id: 'a', profileId: '', name: 'Jane', participantType: 'Team Member' as const, splitPercent: '50' };
    const { cols } = buildSubitem(f, broker, ctx);
    expect(cols[SUB.splitType]).toEqual({ label: 'Team Split' });
    expect(cols[SUB.receivesOriginationCredit]).toEqual({ checked: 'true' });
    expect(cols[SUB.brokerProfilesLink]).toBeUndefined(); // no profile → no link
  });
});

describe('billing writes', () => {
  it('writes billing columns on the Done Deal and each A/R item', () => {
    const f = fullDeal();
    f.billing = {
      sameAsSeller: false, name: 'AP Team', company: 'Seller LLC', address: '1 Main St',
      phone: '(212) 555-0000', email1: 'ap@seller.com', email2: 'cfo@seller.com', email3: '', email4: '',
    };
    const dd = buildDoneDeal(f, computeWaterfall(f), ctx, new Date('2026-07-06T12:00:00Z')).cols;
    expect(dd[DD_BILLING.name]).toBe('AP Team');
    expect(dd[DD_BILLING.company]).toBe('Seller LLC');
    expect(dd[DD_BILLING.address]).toBe('1 Main St');
    expect(dd[DD_BILLING.email2]).toBe('cfo@seller.com');
    expect(dd[DD_BILLING.phone]).toEqual({ phone: '2125550000', countryShortName: 'US' });
    expect(dd[DD_BILLING.email3]).toBeUndefined(); // pruned
    const ar = buildArItem(f, 0, 'dd-1').cols;
    expect(ar[AR_BILLING.name]).toBe('AP Team');
    expect(ar[AR_BILLING.email1]).toBe('ap@seller.com');
    expect(ar[AR_BILLING.phone]).toEqual({ phone: '2125550000', countryShortName: 'US' });
  });

  it('sameAsSeller billing derives from the primary seller card', () => {
    const f = fullDeal();
    f.dealParties.sellers[0].phone = '(917) 555-0101';
    f.billing.sameAsSeller = true;
    f.billing.address = '99 Park Ave';
    const dd = buildDoneDeal(f, computeWaterfall(f), ctx, new Date('2026-07-06T12:00:00Z')).cols;
    expect(dd[DD_BILLING.name]).toBe('Seller LLC');
    expect(dd[DD_BILLING.email1]).toBe('seller@example.com');
    expect(dd[DD_BILLING.address]).toBe('99 Park Ave');
  });
});

describe('buildPartiesUpdate', () => {
  it('returns null when there are no additional parties', () => {
    expect(buildPartiesUpdate(fullDeal())).toBeNull();
  });

  it('formats additional sellers and buyers with numbering from 2', () => {
    const f = fullDeal();
    f.dealParties.sellers.push({
      id: 's2', name: '250 BK Partners LLC', company: 'BK Cap',
      email: 'jane@bk.com', phone: '(917) 555-0102', entity: '250 BK LLC',
    });
    f.dealParties.buyers.push({
      id: 'b2', name: 'Acme Capital', company: '', email: 'bob@acme.com', phone: '', entity: '',
    });
    const body = buildPartiesUpdate(f)!;
    expect(body).toContain('Additional parties (from Done Deal wizard)');
    expect(body).toContain('Sellers:');
    expect(body).toContain('2) 250 BK Partners LLC — BK Cap · jane@bk.com · (917) 555-0102 · 250 BK LLC');
    expect(body).toContain('Buyers:');
    expect(body).toContain('2) Acme Capital · bob@acme.com');
  });
});

describe('buildArItem', () => {
  it('numbers the payment, links the done deal, and names the row', () => {
    const f = fullDeal();
    f.commission.multiplePayments = true;
    f.commission.paymentSchedule = [
      { id: '1', amount: 60000, dueDate: '2026-07-15' },
      { id: '2', amount: 40000, dueDate: '2026-08-15' },
    ];
    const { name, cols } = buildArItem(f, 1, '555');
    expect(name).toBe('500 Broadway — Payment 2 of 2');
    expect(cols[AR.paymentNumber]).toBe(2);
    expect(cols[AR.scheduledAmount]).toBe(40000);
    expect(cols[AR.dueDate]).toEqual({ date: '2026-08-15' });
    expect(cols[AR.doneDealRelation]).toEqual({ item_ids: [555] });
    expect(AR.doneDealRelation).toBe('board_relation_mm0vabds'); // corrected id
  });

  it('writes Due Date with Actual Close Date fallback and derives the single-payment amount', () => {
    const f = fullDeal();
    f.commission.multiplePayments = false;
    f.commission.paymentSchedule = [{ id: 'p1', amount: 0, dueDate: '' }];
    f.dealDetails.actualCloseDate = '2026-07-01';
    const { cols } = buildArItem(f, 0, 'dd-1');
    expect(cols[AR.dueDate]).toEqual({ date: '2026-07-01' });
    expect(cols[AR.scheduledAmount]).toBe(100000); // derived from scheduledCommission
  });
});
