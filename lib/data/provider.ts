// The single data-access contract. UI and tools depend ONLY on this interface,
// never on a concrete provider. Swap MockProvider → MondayProvider later.
// Boards & column IDs: docs/isg-crm-spec.md §6.

import type {
  Activity, Company, Contact, ContactDetail, ExclusiveAgreement, Id,
  Lead, LeadStatus, Listing, ListingDetail, ListingStage, MyList, Pitch, Property,
} from "@/lib/types/entities";

export interface ListingFilter { stage?: ListingStage; office?: string; ownerId?: Id; mineOnly?: boolean; q?: string; }
export interface PitchFilter { stage?: string; mineOnly?: boolean; q?: string; }
export interface ContactFilter { type?: string; market?: string; propertyType?: string; minDeal?: number; maxDeal?: number; q?: string; }
export interface CompanyFilter { type?: string; q?: string; }
export interface PropertyFilter { propertyType?: string; borough?: string; ownerId?: Id; q?: string; }

export interface NewLead {
  listingId: Id;          // REQUIRED — every lead is listing-scoped (brief LEADS-1)
  name: string;
  contactId?: Id;
  company?: string;
  status?: LeadStatus;
  interestLevel?: "High" | "Medium" | "Low";
}

export interface EntityRef { board: string; itemId: Id; }

export interface DataProvider {
  // Pipeline / Listings
  listListings(filter?: ListingFilter): Promise<Listing[]>;
  getListing(id: Id): Promise<ListingDetail>;
  updateListingStage(id: Id, stage: ListingStage): Promise<Listing>;

  // Leads (listing-scoped)
  listLeads(listingId: Id): Promise<Lead[]>;
  createLead(input: NewLead): Promise<Lead>;
  updateLead(id: Id, patch: Partial<Lead>): Promise<Lead>;

  // Pitch Tracker
  listPitches(filter?: PitchFilter): Promise<Pitch[]>;
  promotePitchToListing(pitchId: Id): Promise<Listing>;

  // Network
  listContacts(filter?: ContactFilter): Promise<Contact[]>;
  getContact(id: Id): Promise<ContactDetail>;
  listCompanies(filter?: CompanyFilter): Promise<Company[]>;
  listLists(): Promise<MyList[]>;

  // Properties / Canvassing
  listProperties(filter?: PropertyFilter): Promise<Property[]>;

  // Exclusive Agreements
  listAgreements(): Promise<ExclusiveAgreement[]>;

  // Cross-cutting
  search(q: string): Promise<Array<{ kind: string; id: Id; label: string }>>;
  logActivity(entity: EntityRef, note: string): Promise<Activity>;
}

// Factory — selects provider by env (DATA_PROVIDER=mock|monday). Server-only.
export async function getProvider(): Promise<DataProvider> {
  const kind = process.env.DATA_PROVIDER ?? "mock";
  if (kind === "monday") {
    const { MondayProvider } = await import("./monday-provider");
    return new MondayProvider();
  }
  const { MockProvider } = await import("./mock-provider");
  return new MockProvider();
}
