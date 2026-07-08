import { describe, it, expect, vi } from 'vitest';
vi.mock('../monday/sdk', () => ({ api: vi.fn(), monday: {} }));
import { matchDoneDealToListing, mapContactsToParties, mapLeadItems } from './read';
import { CONTACT, LEAD } from './columns';

describe('mapContactsToParties', () => {
  const contact = (id: string, name: string, company: string, email: string, office: string, cell: string) => ({
    id,
    name,
    column_values: [
      { id: CONTACT.companyText, text: company },
      { id: CONTACT.email, text: email },
      { id: CONTACT.officePhone, text: office },
      { id: CONTACT.cellPhone, text: cell },
    ],
  });

  it('splits multiple contacts into separate clean seller rows (primary first)', () => {
    const parties = mapContactsToParties([
      contact('c1', 'Adrian Mercado', 'Bedford Holdings', 'adrian@bh.com', '2035075484', ''),
      contact('c2', 'Tyler Travis', 'Roeper Capital', 'tyler@rc.com', '', '2305550999'),
    ]);
    expect(parties).toHaveLength(2);
    expect(parties[0]).toEqual({
      id: 'seller-1', name: 'Adrian Mercado', company: 'Bedford Holdings',
      email: 'adrian@bh.com', phone: '2035075484', entity: '',
    });
    // Second contact: office phone empty → falls back to cell.
    expect(parties[1].name).toBe('Tyler Travis');
    expect(parties[1].phone).toBe('2305550999');
  });

  it('prefers office phone over cell and returns [] for no contacts', () => {
    const p = mapContactsToParties([contact('c1', 'Jane Roe', 'Acme', 'j@acme.com', '2120000000', '9990000000')]);
    expect(p[0].phone).toBe('2120000000');
    expect(mapContactsToParties([])).toEqual([]);
  });
});

describe('mapLeadItems', () => {
  const lead = (
    id: string,
    name: string,
    cols: Partial<Record<string, { text?: string | null; display_value?: string | null }>>,
  ) => ({
    id,
    name,
    column_values: Object.entries(cols).map(([cid, v]) => ({
      id: cid,
      text: v?.text ?? null,
      display_value: v?.display_value,
    })),
  });

  it('prefers contact mirrors, falls back to Ai fields, and parses offer price', () => {
    const [l] = mapLeadItems([
      lead('L1', 'Kent Capital', {
        [LEAD.companyMirror]: { display_value: 'Kent Cap LLC' },
        [LEAD.emailMirror]: { display_value: '' }, // empty mirror → Ai fallback
        [LEAD.aiEmail]: { text: 'acq@kentcap.com' },
        [LEAD.offerPrice]: { text: '12,500,000' },
        [LEAD.offerDate]: { text: '2026-06-01' },
        [LEAD.status]: { text: '4.2 Offer Accepted' },
      }),
    ]);
    expect(l.company).toBe('Kent Cap LLC');
    expect(l.email).toBe('acq@kentcap.com');
    expect(l.offerPrice).toBe(12500000);
    expect(l.offerDate).toBe('2026-06-01');
    expect(l.status).toBe('4.2 Offer Accepted');
  });

  it('sorts leads with offers first (highest offer on top)', () => {
    const out = mapLeadItems([
      lead('L1', 'No Offer', {}),
      lead('L2', 'Low Offer', { [LEAD.offerPrice]: { text: '1000000' } }),
      lead('L3', 'High Offer', { [LEAD.offerPrice]: { text: '2000000' } }),
    ]);
    expect(out.map((l) => l.id)).toEqual(['L3', 'L2', 'L1']);
    expect(out[2].offerPrice).toBeNull();
  });
});

describe('matchDoneDealToListing', () => {
  const items = [
    { id: 'dd-3', linked: [111, 222] },
    { id: 'dd-2', linked: [333] },
    { id: 'dd-1', linked: [] },
  ];

  it('returns the first Done Deal whose Source Deal Link contains the listing id', () => {
    expect(matchDoneDealToListing(items, '333')).toBe('dd-2');
    expect(matchDoneDealToListing(items, '222')).toBe('dd-3');
  });

  it('returns null when no Done Deal links back to the listing', () => {
    expect(matchDoneDealToListing(items, '999')).toBeNull();
    expect(matchDoneDealToListing([], '111')).toBeNull();
  });
});
