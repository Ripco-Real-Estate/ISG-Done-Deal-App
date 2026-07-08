import { api, monday } from '../monday/sdk';
import { BOARDS, ISG, DD, PROFILE, REL, CONTACT, LEAD } from './columns';
import type { FormData, ListingItem, PartyEntry, Profile, UploadedFile } from './types';
import { INITIAL_FORM_DATA } from './types';

/** All ISG columns the wizard reads, deduped. */
const READ_COLUMN_IDS = Array.from(
  new Set([
    ISG.dealStage,
    ISG.propertyTypeStatus,
    ISG.totalSfMirror,
    ISG.capRate,
    ISG.resiUnits,
    ISG.commUnits,
    ISG.totalUnits,
    ISG.isDevelopment,
    ISG.isMultiProperty,
    ISG.addressMirror,
    ISG.transactionType,
    ISG.sourceType,
    ISG.finalSalesPrice,
    ISG.scheduledCommission,
    ISG.baseRate,
    ISG.contractPrice,
    ISG.actualCloseDate,
    ISG.transactionSummary,
    ISG.ownerNameMirror,
    ISG.ownerCompanyMirror,
    ISG.emailMirror,
    ISG.officePhoneMirror,
    ISG.cellPhoneMirror,
    ISG.ownerEntity,
    ISG.lead,
    ISG.team,
    ISG.fileePsa,
    ISG.fileExclusiveAgreement,
    ISG.fileCoBrokerAgreement,
    ISG.fileReferralAgreement,
    ISG.fileCommissionAgreement,
    ISG.fileCoBrokerW9,
    ISG.fileReferralW9,
  ]),
);

interface RawColumnValue {
  id: string;
  text: string | null;
  value: string | null;
  display_value?: string | null;
}

/** Read the current ISG Listings item and its needed columns. */
export async function readListing(itemId: string): Promise<ListingItem> {
  const query = `
    query ReadListing($itemId: [ID!], $cols: [String!]) {
      items(ids: $itemId) {
        id
        name
        column_values(ids: $cols) {
          id
          text
          value
          ... on MirrorValue { display_value }
        }
      }
    }`;
  const data = await api<{
    items: Array<{ id: string; name: string; column_values: RawColumnValue[] }>;
  }>(query, { itemId: [itemId], cols: READ_COLUMN_IDS });

  const item = data.items?.[0];
  if (!item) throw new Error(`ISG Listings item ${itemId} not found`);

  const raw: ListingItem['raw'] = {};
  for (const cv of item.column_values) {
    raw[cv.id] = { text: cv.text, value: cv.value, displayValue: cv.display_value ?? null };
  }

  return {
    id: item.id,
    name: item.name,
    dealStage: raw[ISG.dealStage]?.text ?? '',
    raw,
  };
}

/** Best display string for a column: mirror display_value, else text. */
function disp(item: ListingItem, colId: string): string {
  const cv = item.raw[colId];
  return (cv?.displayValue ?? cv?.text ?? '').trim();
}

function toNum(s: string): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[$,%\s,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Parse the file column `value` JSON into a simple UploadedFile[]. */
function parseFiles(item: ListingItem, colId: string): UploadedFile[] {
  const cv = item.raw[colId];
  if (!cv?.value) return [];
  try {
    const parsed = JSON.parse(cv.value) as { files?: Array<{ name?: string; assetId?: number }> };
    return (parsed.files ?? []).map((f) => ({
      id: f.assetId ? String(f.assetId) : undefined,
      name: f.name ?? 'file',
    }));
  } catch {
    // Fall back to the text label if the value JSON is unexpected.
    return cv.text ? [{ name: cv.text }] : [];
  }
}

/** Map "Yes"/"No" status text to our YesNo, defaulting to No. */
function yesNo(item: ListingItem, colId: string): 'Yes' | 'No' {
  return disp(item, colId).toLowerCase() === 'yes' ? 'Yes' : 'No';
}

/**
 * Pre-fill FormData from the listing (only when there's no saved draft).
 * Mirrors → editable fields; files → detected slots.
 */
export function prefillFromItem(item: ListingItem): FormData {
  const f: FormData = structuredClone(INITIAL_FORM_DATA);

  f.metrics.propertyType = disp(item, ISG.propertyTypeStatus);
  f.metrics.totalSf = toNum(disp(item, ISG.totalSfMirror));
  f.metrics.capRate = toNum(disp(item, ISG.capRate));
  f.metrics.resiUnits = disp(item, ISG.resiUnits);
  f.metrics.commUnits = toNum(disp(item, ISG.commUnits));
  f.metrics.totalUnits = toNum(disp(item, ISG.totalUnits));
  f.metrics.isDevelopment = yesNo(item, ISG.isDevelopment);
  f.metrics.isMultiProperty = yesNo(item, ISG.isMultiProperty);

  f.dealDetails.address = disp(item, ISG.addressMirror);
  f.dealDetails.transactionType = disp(item, ISG.transactionType);
  f.dealDetails.sourceType = disp(item, ISG.sourceType);
  f.dealDetails.finalSalesPrice = toNum(disp(item, ISG.finalSalesPrice));
  f.dealDetails.scheduledCommission = toNum(disp(item, ISG.scheduledCommission));
  f.dealDetails.baseRate = toNum(disp(item, ISG.baseRate));
  f.dealDetails.contractPrice = toNum(disp(item, ISG.contractPrice));
  f.dealDetails.actualCloseDate = disp(item, ISG.actualCloseDate);
  f.dealDetails.transactionSummary = disp(item, ISG.transactionSummary);

  f.dealParties.sellers = [{
    id: 'seller-1',
    name: disp(item, ISG.ownerNameMirror),
    company: disp(item, ISG.ownerCompanyMirror),
    email: disp(item, ISG.emailMirror),
    phone: disp(item, ISG.officePhoneMirror) || disp(item, ISG.cellPhoneMirror),
    entity: disp(item, ISG.ownerEntity),
  }];

  f.documents.psa = parseFiles(item, ISG.fileePsa);
  f.documents.exclusiveAgreement = parseFiles(item, ISG.fileExclusiveAgreement);
  f.documents.coBrokerAgreement = parseFiles(item, ISG.fileCoBrokerAgreement);
  f.documents.referralAgreement = parseFiles(item, ISG.fileReferralAgreement);
  f.documents.commissionAgreement = parseFiles(item, ISG.fileCommissionAgreement);
  f.documents.coBrokerW9 = parseFiles(item, ISG.fileCoBrokerW9);
  f.documents.referralW9 = parseFiles(item, ISG.fileReferralW9);

  // Default the single A/R payment row to the scheduled commission.
  if (f.dealDetails.scheduledCommission) {
    f.commission.paymentSchedule = [
      { id: 'payment-1', amount: f.dealDetails.scheduledCommission, dueDate: '' },
    ];
  }

  return f;
}

/**
 * Read Active broker profiles (cross-board, non-blocking). Errors resolve to []
 * so the UI falls back to manual broker entry.
 */
export async function readActiveProfiles(): Promise<Profile[]> {
  const query = `
    query Profiles($board: [ID!], $status: [String!], $user: [String!]) {
      boards(ids: $board) {
        items_page(limit: 500) {
          items {
            id
            name
            status: column_values(ids: $status) { id text }
            user: column_values(ids: $user) {
              ... on PeopleValue { persons_and_teams { id kind } }
            }
          }
        }
      }
    }`;
  try {
    const data = await api<{
      boards: Array<{
        items_page: {
          items: Array<{
            id: string;
            name: string;
            status: Array<{ id: string; text: string | null }>;
            user: Array<{ persons_and_teams?: Array<{ id: number; kind: string }> }>;
          }>;
        };
      }>;
    }>(query, {
      board: [BOARDS.brokerProfiles],
      status: [PROFILE.activeStatus],
      user: [PROFILE.mondayUser],
    });

    const items = data.boards?.[0]?.items_page?.items ?? [];
    return items.map((it) => ({
      id: it.id,
      name: it.name,
      active: (it.status?.[0]?.text ?? '') === 'Active',
      userIds: (it.user?.[0]?.persons_and_teams ?? [])
        .filter((p) => p.kind === 'person')
        .map((p) => p.id),
    }));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[read] readActiveProfiles failed — manual entry fallback', e);
    return [];
  }
}

/** First Done Deal whose Source Deal Link contains the listing id (pure, testable). */
export function matchDoneDealToListing(
  items: Array<{ id: string; linked: number[] }>,
  listingId: string,
): string | null {
  const target = Number(listingId);
  return items.find((it) => it.linked.includes(target))?.id ?? null;
}

/**
 * Resolve the Done Deal created from this listing, via the Done Deals board's
 * Source Deal Link (ISG Listings has no reverse relation — verified 2026-07-07).
 * Scans the first 100 items (board is young); errors resolve to null (the link is a nicety).
 */
export async function findDoneDealForListing(listingId: string): Promise<string | null> {
  const query = `
    query FindDoneDeal($board: [ID!], $rel: [String!]) {
      boards(ids: $board) {
        items_page(limit: 100) {
          items {
            id
            link: column_values(ids: $rel) {
              ... on BoardRelationValue { linked_item_ids }
            }
          }
        }
      }
    }`;
  try {
    const data = await api<{
      boards: Array<{
        items_page: { items: Array<{ id: string; link: Array<{ linked_item_ids?: string[] | null }> }> };
      }>;
    }>(query, { board: [BOARDS.doneDeals], rel: [DD.sourceDealLink] });
    const items = (data.boards?.[0]?.items_page?.items ?? []).map((it) => ({
      id: it.id,
      linked: (it.link?.[0]?.linked_item_ids ?? []).map(Number),
    }));
    return matchDoneDealToListing(items, listingId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[read] findDoneDealForListing failed — link hidden', e);
    return null;
  }
}

/** A linked Contact item, trimmed to the fields the wizard needs. */
interface RawContactItem {
  id: string;
  name: string;
  column_values: Array<{ id: string; text: string | null }>;
}

/**
 * Map linked Contact items to seller PartyEntry rows (index 0 = primary). Pure and
 * testable. One clean row per contact — the fix for multi-owner deals that Monday
 * otherwise comma-joins into a single mangled row. Phone prefers office, then cell.
 */
export function mapContactsToParties(contacts: RawContactItem[]): PartyEntry[] {
  return contacts.map((c, i) => {
    const text = (colId: string) => (c.column_values.find((cv) => cv.id === colId)?.text ?? '').trim();
    return {
      id: `seller-${i + 1}`,
      name: (c.name ?? '').trim(),
      company: text(CONTACT.companyText),
      email: text(CONTACT.email),
      phone: text(CONTACT.officePhone) || text(CONTACT.cellPhone),
      entity: '',
    };
  });
}

/**
 * Read the listing's owner contacts as separate seller rows via
 * Listing → Property Record → Contact Name. Returns [] on any missing link or error
 * so the caller falls back to the mirror-based single-seller prefill. Never throws.
 */
export async function readSellerContacts(listingId: string): Promise<PartyEntry[]> {
  const linkedIds = (data: {
    items?: Array<{ column_values: Array<{ linked_item_ids?: string[] | null }> }>;
  }): string[] => data.items?.[0]?.column_values?.[0]?.linked_item_ids ?? [];

  try {
    // 1. Listing → Property Record
    const q1 = `query ($id: [ID!]) {
      items(ids: $id) { column_values(ids: ["${REL.listingToProperty}"]) {
        ... on BoardRelationValue { linked_item_ids } } } }`;
    const propertyId = linkedIds(await api(q1, { id: [listingId] }))[0];
    if (!propertyId) return [];

    // 2. Property → Contact Name
    const q2 = `query ($id: [ID!]) {
      items(ids: $id) { column_values(ids: ["${REL.propertyToContacts}"]) {
        ... on BoardRelationValue { linked_item_ids } } } }`;
    const contactIds = linkedIds(await api(q2, { id: [propertyId] }));
    if (contactIds.length === 0) return [];

    // 3. Each contact's fields
    const q3 = `query ($ids: [ID!]) {
      items(ids: $ids) { id name
        column_values(ids: ["${CONTACT.companyText}", "${CONTACT.email}", "${CONTACT.officePhone}", "${CONTACT.cellPhone}"]) { id text } } }`;
    const d3 = await api<{ items: RawContactItem[] }>(q3, { ids: contactIds });

    // Preserve the linked order (items(ids:) does not guarantee it).
    const byId = new Map((d3.items ?? []).map((it) => [it.id, it]));
    const ordered = contactIds.map((id) => byId.get(String(id))).filter((x): x is RawContactItem => !!x);
    return mapContactsToParties(ordered);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[read] readSellerContacts failed — mirror prefill fallback', e);
    return [];
  }
}

/** A lead from the ISG Leads Tracker, shaped for the winning-buyer picker. */
export interface LeadOption {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  offerPrice: number | null;
  /** YYYY-MM-DD ('' when none). */
  offerDate: string;
  status: string;
}

interface RawLeadItem {
  id: string;
  name: string;
  column_values: Array<{ id: string; text: string | null; display_value?: string | null }>;
}

/**
 * Map Leads Tracker items to LeadOption[s]. Pure and testable. Contact mirrors win;
 * the Ai: columns fill gaps when no contact is linked. Leads with offers sort first
 * (highest offer on top) since the winner is almost always among them.
 */
export function mapLeadItems(items: RawLeadItem[]): LeadOption[] {
  const mapped = items.map((it) => {
    const val = (colId: string) => {
      const cv = it.column_values.find((c) => c.id === colId);
      return (cv?.display_value ?? cv?.text ?? '').trim();
    };
    const priceRaw = val(LEAD.offerPrice);
    const price = priceRaw ? parseFloat(priceRaw.replace(/[$,\s]/g, '')) : NaN;
    return {
      id: it.id,
      name: (it.name ?? '').trim() || val(LEAD.aiName),
      company: val(LEAD.companyMirror) || val(LEAD.aiCompany),
      email: val(LEAD.emailMirror) || val(LEAD.aiEmail),
      phone: val(LEAD.cellPhoneMirror) || val(LEAD.aiPhone),
      offerPrice: Number.isFinite(price) ? price : null,
      offerDate: val(LEAD.offerDate),
      status: val(LEAD.status),
    };
  });
  return mapped.sort((a, b) => (b.offerPrice ?? -1) - (a.offerPrice ?? -1));
}

/**
 * Read the listing's linked leads (buyer funnel) for the optional winning-buyer
 * picker. Errors / no links resolve to [] — the picker simply doesn't render.
 */
export async function readListingLeads(listingId: string): Promise<LeadOption[]> {
  try {
    const q1 = `query ($id: [ID!]) {
      items(ids: $id) { column_values(ids: ["${REL.listingToLeads}"]) {
        ... on BoardRelationValue { linked_item_ids } } } }`;
    const d1 = await api<{
      items?: Array<{ column_values: Array<{ linked_item_ids?: string[] | null }> }>;
    }>(q1, { id: [listingId] });
    const leadIds = (d1.items?.[0]?.column_values?.[0]?.linked_item_ids ?? []).slice(0, 100);
    if (leadIds.length === 0) return [];

    const q2 = `query ($ids: [ID!]) {
      items(ids: $ids) { id name
        column_values(ids: ["${LEAD.status}", "${LEAD.offerPrice}", "${LEAD.offerDate}", "${LEAD.companyMirror}", "${LEAD.emailMirror}", "${LEAD.cellPhoneMirror}", "${LEAD.aiName}", "${LEAD.aiCompany}", "${LEAD.aiEmail}", "${LEAD.aiPhone}"]) {
          id text ... on MirrorValue { display_value } } } }`;
    const d2 = await api<{ items: RawLeadItem[] }>(q2, { ids: leadIds });
    return mapLeadItems(d2.items ?? []);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[read] readListingLeads failed — picker hidden', e);
    return [];
  }
}

/** Current monday user (id + name). Falls back to a dev identity off-platform. */
export async function getContext(): Promise<{ userId: number | null; userName: string }> {
  try {
    const resp = (await monday.get('context')) as {
      data?: { user?: { id?: number | string; name?: string } };
    };
    const u = resp?.data?.user;
    if (u?.id) return { userId: Number(u.id), userName: u.name ?? 'Monday User' };
  } catch {
    /* off-platform dev */
  }
  return { userId: null, userName: 'Adrian Mercado' };
}
