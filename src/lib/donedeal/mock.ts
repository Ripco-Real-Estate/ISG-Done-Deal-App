import type { FormData, Profile } from './types';
import type { ContactHit } from './contacts';
import { INITIAL_FORM_DATA } from './types';

/**
 * Local preview data — used ONLY when the app is opened with `?mock=1`. Lets you
 * click through all 7 steps on localhost without a monday session. Never reached
 * on the real (monday-embedded) path; submit is simulated, no API calls.
 */
export const MOCK_ITEM_ID = 'mock-listing';

/** True when the app is opened with `?mock=1` (local preview, no monday host). */
export function isMockMode(): boolean {
  const search = typeof window !== 'undefined' ? window.location?.search : '';
  return new URLSearchParams(search || '').get('mock') === '1';
}

/** Canned ContactLookup results for `?mock=1` — zero API calls. */
export const MOCK_CONTACTS: ContactHit[] = [
  { id: 'c1', name: 'Jane Roe', company: 'Bedford Holdings LLC', email: 'jane@bedfordholdings.com', phone: '(917) 555-0101', type: 'Owner' },
  { id: 'c2', name: 'James Roeper', company: 'Roeper Capital', email: 'james@roepercap.com', phone: '(646) 555-0102', type: 'Investor' },
  { id: 'c3', name: 'Maria Chen', company: '250 BK Partners LLC', email: 'maria@250bk.com', phone: '(718) 555-0103', type: 'Owner' },
  { id: 'c4', name: 'Robert Lee', company: 'Acme Capital', email: 'bob@acmecap.com', phone: '(212) 555-0104', type: 'Investor' },
  { id: 'c5', name: 'Sandra Ortiz', company: 'Ortiz Family Office', email: 'sandra@ortizfo.com', phone: '(917) 555-0105', type: 'Family Office' },
  { id: 'c6', name: 'David Kim', company: 'DK Properties', email: 'dkim@dkprop.com', phone: '(347) 555-0106', type: 'Developer' },
];

export const MOCK_PROFILES: Profile[] = [
  { id: '9001', name: 'Todd Cooper', active: true, userIds: [] },
  { id: '9002', name: 'Mark Kaplan', active: true, userIds: [] },
  { id: '9003', name: 'Peter Ripka', active: true, userIds: [] },
  { id: '9101', name: 'Adrian Mercado', active: true, userIds: [] },
  { id: '9102', name: 'Tyler Travis', active: true, userIds: [] },
  { id: '9103', name: 'Marissa Sparke', active: false, userIds: [] },
];

export function mockForm(): FormData {
  const f = structuredClone(INITIAL_FORM_DATA);
  f.metrics.propertyType = 'Multifamily';
  f.metrics.totalSf = 24000;
  f.metrics.capRate = 5.25;
  f.metrics.resiUnits = '18';
  f.metrics.commUnits = 2;
  f.metrics.totalUnits = 20;

  f.dealDetails.address = '250 Bedford Ave, Brooklyn, NY';
  f.dealDetails.transactionType = 'Sale';
  f.dealDetails.sourceType = 'iSales-Seller Rep';
  f.dealDetails.finalSalesPrice = 12500000;
  f.dealDetails.scheduledCommission = 250000;
  f.dealDetails.baseRate = 2;
  f.dealDetails.contractPrice = 12750000;
  f.dealDetails.actualCloseDate = '2026-06-30';
  f.dealDetails.transactionSummary = 'Stabilized 20-unit mixed-use asset, all-cash buyer, 45-day close.';

  f.dealParties.sellers = [{
    id: 'seller-1',
    name: 'Bedford Holdings LLC',
    company: 'Bedford Holdings LLC',
    email: 'ops@bedfordholdings.com',
    phone: '(718) 555-0142',
    entity: 'Bedford Holdings LLC',
  }];
  f.dealParties.buyers = [{
    id: 'buyer-1',
    name: 'Kent Capital Partners',
    company: 'Kent Capital',
    email: 'acq@kentcap.com',
    phone: '',
    entity: '',
  }];

  f.billing = {
    sameAsSeller: false,
    name: 'Jane Roe',
    company: 'Bedford Holdings LLC',
    address: '250 Bedford Ave, Brooklyn, NY 11211',
    phone: '(917) 555-0142',
    email1: 'ap@bedfordholdings.com',
    email2: '',
    email3: '',
    email4: '',
  };

  f.commission.paymentSchedule = [{ id: 'payment-1', amount: 0, dueDate: '2026-06-30' }];

  return f;
}
