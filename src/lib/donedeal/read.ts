import { api, monday } from '../monday/sdk';
import { BOARDS, ISG, DD, PROFILE } from './columns';
import type { FormData, ListingItem, Profile, UploadedFile } from './types';
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
