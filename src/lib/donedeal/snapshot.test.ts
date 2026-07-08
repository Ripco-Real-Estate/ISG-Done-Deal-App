import { describe, it, expect } from 'vitest';
import { buildContextSnapshot } from './snapshot';
import { computeWaterfall } from './compute';
import { INITIAL_FORM_DATA, type FormData } from './types';

function deal(): FormData {
  const f = structuredClone(INITIAL_FORM_DATA);
  f.dealDetails.address = '250 Bedford Ave';
  f.dealDetails.sourceType = 'iSales-Seller Rep';
  f.dealDetails.finalSalesPrice = 12500000;
  f.dealDetails.scheduledCommission = 250000;
  f.metrics.totalSf = 24000;
  f.dealParties.sellers = [
    { id: 's1', name: 'Adrian Mercado', company: 'Bedford Holdings', email: 'a@bh.com', phone: '2035075484', entity: '' },
    { id: 's2', name: 'Tyler Travis', company: 'Roeper Capital', email: 't@rc.com', phone: '2305550999', entity: '' },
  ];
  f.dealParties.buyers = [{ id: 'b1', name: 'Kent Capital', company: '', email: '', phone: '', entity: '' }];
  f.commission.brokers = [
    { id: 'br1', profileId: '', name: 'Jane Broker', participantType: 'Team Member', splitPercent: '100' },
  ];
  f.commission.paymentSchedule = [{ id: 'p1', amount: 250000, dueDate: '' }];
  return f;
}

describe('buildContextSnapshot', () => {
  it('includes EVERY seller and buyer, the splits, and formatted money', () => {
    const snap = buildContextSnapshot(deal(), computeWaterfall(deal()));
    expect(snap).toContain('SUBMISSION SNAPSHOT');
    expect(snap).toContain('Adrian Mercado');
    expect(snap).toContain('Tyler Travis'); // the second seller is NOT dropped
    expect(snap).toContain('Kent Capital');
    expect(snap).toContain('Jane Broker');
    expect(snap).toContain('$12,500,000'); // final sales price, USD formatted
    expect(snap).toContain('24,000'); // total SF, thousands separator
    expect(snap).toContain('Source Type: iSales-Seller Rep');
  });

  it('includes the winning lead line when a lead is selected', () => {
    const f = deal();
    f.dealParties.winningLead = { id: 'L9', name: 'Kent Capital', offerPrice: 12000000, offerDate: '2026-06-01' };
    const snap = buildContextSnapshot(f, computeWaterfall(f));
    expect(snap).toContain('Winning lead (Leads Tracker L9): Kent Capital — offer $12,000,000.00 on 2026-06-01');
    // And absent when none selected:
    expect(buildContextSnapshot(deal(), computeWaterfall(deal()))).not.toContain('Winning lead');
  });

  it('is deterministic (no Date) — same input yields identical output', () => {
    const a = buildContextSnapshot(deal(), computeWaterfall(deal()));
    const b = buildContextSnapshot(deal(), computeWaterfall(deal()));
    expect(a).toBe(b);
  });
});
