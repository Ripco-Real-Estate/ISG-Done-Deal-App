// MockProvider — reads seed JSON from lib/data/seed/*.json.
// This is the prototype's real data source. Implement per the brief (M1+).
// Writes mutate in-memory state (or a Zustand store) so the UI updates without a backend.

import type { DataProvider, ListingFilter, PitchFilter, ContactFilter, CompanyFilter, PropertyFilter, NewLead, EntityRef } from "./provider";
import type {
  Activity, Company, Contact, ContactDetail, ExclusiveAgreement, Id,
  Lead, Listing, ListingDetail, ListingStage, MyList, Pitch, Property,
} from "@/lib/types/entities";

// TODO(M1): import seed JSON, e.g.
//   import listings from "./seed/listings.json";
//   import leads from "./seed/leads.json"; ...
// Keep an in-memory copy that write methods mutate.

const NOT_IMPL = (m: string) => { throw new Error(`MockProvider.${m} not implemented yet — see docs/isg-crm-features-build-brief.md`); };

export class MockProvider implements DataProvider {
  async listListings(_f?: ListingFilter): Promise<Listing[]> { return NOT_IMPL("listListings"); }
  async getListing(_id: Id): Promise<ListingDetail> { return NOT_IMPL("getListing"); }
  async updateListingStage(_id: Id, _stage: ListingStage): Promise<Listing> { return NOT_IMPL("updateListingStage"); }
  async listLeads(_listingId: Id): Promise<Lead[]> { return NOT_IMPL("listLeads"); }
  async createLead(_input: NewLead): Promise<Lead> { return NOT_IMPL("createLead"); }
  async updateLead(_id: Id, _patch: Partial<Lead>): Promise<Lead> { return NOT_IMPL("updateLead"); }
  async listPitches(_f?: PitchFilter): Promise<Pitch[]> { return NOT_IMPL("listPitches"); }
  async promotePitchToListing(_pitchId: Id): Promise<Listing> { return NOT_IMPL("promotePitchToListing"); }
  async listContacts(_f?: ContactFilter): Promise<Contact[]> { return NOT_IMPL("listContacts"); }
  async getContact(_id: Id): Promise<ContactDetail> { return NOT_IMPL("getContact"); }
  async listCompanies(_f?: CompanyFilter): Promise<Company[]> { return NOT_IMPL("listCompanies"); }
  async listLists(): Promise<MyList[]> { return NOT_IMPL("listLists"); }
  async listProperties(_f?: PropertyFilter): Promise<Property[]> { return NOT_IMPL("listProperties"); }
  async listAgreements(): Promise<ExclusiveAgreement[]> { return NOT_IMPL("listAgreements"); }
  async search(_q: string): Promise<Array<{ kind: string; id: Id; label: string }>> { return NOT_IMPL("search"); }
  async logActivity(_entity: EntityRef, _note: string): Promise<Activity> { return NOT_IMPL("logActivity"); }
}
