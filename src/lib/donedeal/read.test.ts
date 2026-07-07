import { describe, it, expect, vi } from 'vitest';
vi.mock('../monday/sdk', () => ({ api: vi.fn(), monday: {} }));
import { matchDoneDealToListing } from './read';

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
