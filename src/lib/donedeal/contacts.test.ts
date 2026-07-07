import { describe, it, expect, vi } from 'vitest';
vi.mock('../monday/sdk', () => ({ api: vi.fn() }));
import { mapContactItems } from './contacts';

describe('mapContactItems', () => {
  it('maps column values and prefers the relation display_value for company', () => {
    const hits = mapContactItems([
      {
        id: '77',
        name: 'Jane Roe',
        column_values: [
          { id: 'contact_email', text: 'jane@bh.com' },
          { id: 'phone_mktsq7p5', text: '' },
          { id: 'contact_phone', text: '(212) 555-0000' },
          { id: 'status', text: 'Owner' },
          { id: 'text_mm3c5j1t', text: 'Fallback Co' },
        ],
        company: [{ display_value: 'Bedford Holdings LLC' }],
      },
    ]);
    expect(hits[0]).toEqual({
      id: '77',
      name: 'Jane Roe',
      company: 'Bedford Holdings LLC',
      email: 'jane@bh.com',
      phone: '(212) 555-0000',
      type: 'Owner',
    });
  });

  it('falls back to the company text column when the relation is empty', () => {
    const hits = mapContactItems([
      {
        id: '78',
        name: 'Bob Lee',
        column_values: [
          { id: 'contact_email', text: null },
          { id: 'phone_mktsq7p5', text: '(917) 555-0001' },
          { id: 'text_mm3c5j1t', text: 'Fallback Co' },
        ],
        company: [{}],
      },
    ]);
    expect(hits[0].company).toBe('Fallback Co');
    expect(hits[0].phone).toBe('(917) 555-0001'); // cell wins over office
    expect(hits[0].email).toBe('');
  });
});
