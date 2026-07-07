// Entity types mirror the 8 Monday boards in docs/isg-crm-spec.md §6.
// Each field keeps a `// <columnId>` comment so MondayProvider mapping is mechanical.

export type Id = string;

// ContactsISG · 9262635615
export type ContactType =
  | "Owner" | "Investor" | "Attorney" | "Developer" | "Lender"
  | "Broker" | "User" | "Family Office" | "Private Equity" | "N/A";

export interface Contact {
  id: Id;                       // pulse_id_mm0vs2y5
  name: string;                 // name
  firstName?: string;           // text_mkts6hew
  type: ContactType;            // status (Type)
  role?: string;                // text6
  companyId?: Id;               // board_relation_mkskzf2a → Companies
  cellPhone?: string;           // phone_mktsq7p5
  officePhone?: string;         // contact_phone
  email?: string;               // contact_email
  lastContact?: string;         // date_mkyrgsxr (ISO)
  ownerIds?: Id[];              // multiple_person_mm2027kc
  visibilityIds?: Id[];         // people__1 (scoping)
  // Investor Criteria (IC:)
  investorRating?: number;      // rating_mm3ckgz7
  icMarkets?: string[];         // dropdown_mm3c1vz5
  icPropertyTypes?: string[];   // dropdown_mm3c5q3f
  icDealSizeMin?: number;       // numeric_mm3cyyxy
  icDealSizeMax?: number;       // numeric_mm3c5fk9
  icCondition?: string[];       // dropdown_mm3c1y00
  ic1031Status?: string;        // color_mm3cahj2
}

// Companies · 9526814002
export interface Company {
  id: Id;                       // name item id
  name: string;                 // name
  type?: "Investor" | "Developer" | "Attorney" | "Broker" | "3rd Party"; // status
  parentCompanyId?: Id;         // board_relation_mm0vf5f5
  contactIds?: Id[];            // board_relation_mksk3064
  url?: string;                 // company_domain
  description?: string;         // company_description
}

// My Lists · 9871281018
export interface MyList {
  id: Id;
  name: string;                 // name
  listType: "Contact List" | "Property List" | "Deal Outreach List" | "Other"; // color_mkyv2w79
  description?: string;         // text_mkyrdgfc
  memberIds: Id[];              // board_relation_mkyrbn4c (contacts/properties)
  count?: number;               // lookup_mm2866j2
}

// ISG Pitch Tracker · 9262635627
export type PitchStage =
  | "xx. Waiting on Info" | "00. On Radar" | "1. BOV"
  | "2. Pitching Landlord" | "3. Pitched" | "4. Negotiating Listing" | "xx. Listing Won";

export interface Pitch {
  id: Id;
  name: string;                 // name
  stage: PitchStage;            // lead_status (Deal Stage)
  dealStatus?: "Active" | "Awaiting Decision" | "Warm Lead" | "On Hold" | "Dead"; // color_mks92mj1
  propertyId?: Id;              // board_relation_mkre6ypc
  leadIds?: Id[];               // lead_owner (people)
  estimatedValue?: number;      // numeric_mkqyhx4b
  estCommission?: number;       // numeric_mkqyvhjh
  office?: string;              // color_mkxara9c
  bovRequested?: boolean;       // color_mm1hwsbw
  listingId?: Id;               // board_relation_mm06hq2x (on win)
}

// ISG Listings · 9262635626
export type ListingStage =
  | "00. New" | "1. Preparing Materials" | "2. Listed" | "3. Contracts Out"
  | "4.1. In Contract (DD)" | "4.2. In Contract (Hard)" | "5. Closing Review" | "xx. Done Deal";

export interface Listing {
  id: Id;
  name: string;                 // name
  stage: ListingStage;          // deal_stage
  dealStatus?: "Active" | "On Hold" | "Dead" | "Done Deal"; // color_mkrdf2q8
  eaStatus?: "Uploaded" | "Upload Required";                // color_mkq1pf8r
  office?: string;              // color_mkx4mrgw
  propertyId?: Id;              // board_relation_mkrdxwqb
  ownerEntity?: string;         // text_mm16g57z
  listingPrice?: number;        // numeric_mkrdb9pe
  contractPrice?: number;       // numeric_mm0smkhq
  finalSalesPrice?: number;     // numeric_mkrerp9p
  baseRatePct?: number;         // numeric_mm164261
  scheduledCommission?: number; // numeric_mkrdp021
  netToRipco?: number;          // numeric_mm2xd4p8
  capRate?: number;             // numeric_mm2wset5
  expectedCloseDate?: string;   // deal_expected_close_date
  dateOnMarket?: string;        // date_mm0e4yz5
  leadIds?: Id[];               // multiple_person_mkq8v3qn
  teamIds?: Id[];               // multiple_person_mkq8e8cd
  leadTrackerIds?: Id[];        // board_relation_mkre1cj2 → Leads
  agreementId?: Id;             // board_relation_mm16ge45 → Exclusive Agreements
  // convenience mirrors (read-only on Monday)
  address?: string;             // lookup_mks9s7wd
  propertyType?: string;        // color_mkqys43g
  ownerName?: string;           // lookup_mks9prrj
}

// ISG Leads Tracker · 9263596898
export type LeadStatus =
  | "1. Outreach Made" | "2. Interested" | "3. Touring" | "4.0 Expecting Offer"
  | "4.1 Offer Submitted" | "4.2 Offer Accepted" | "5.1 Contract Out" | "5.2 In Contract"
  | "xx. Buyer" | "xx. Not Interested" | "xx. Offer Rejected";

export interface Lead {
  id: Id;
  name: string;                 // name
  listingId: Id;                // board_relation_mkre94ze (REQUIRED — listing-scoped)
  contactId?: Id;               // board_relation_mkre9mpp → ContactsISG
  status: LeadStatus;           // status
  interestLevel?: "High" | "Medium" | "Low"; // color_mkwfw5tk
  nda?: "In Progress" | "Signed NDA" | "Not Signed" | "Not Applicable"; // color_mktzt79z
  tourStatus?: string;          // color_mktzsdgv
  tourDate?: string;            // date_mktz3x4m
  offerDate?: string;           // date4
  offerPrice?: number;          // numeric_mkrenrvk
  initialDeposit?: string;      // text_mm1spqmg
  closingPeriod?: string;       // text_mm1sc37v
  contingencies?: string;       // text_mm1syvx7
  ddPeriod?: string;            // text_mm1s770a
  comments?: string;            // long_text_mkrew3tv
  ownerIds?: Id[];              // person
}

// Properties Database · 9262635619
export interface Property {
  id: Id;
  name: string;                 // name
  propertyType?: string;        // color_mkrd2ax6
  address?: string;             // location
  city?: string;                // text_mkrdtzev
  state?: string;               // text_mkrddbc7
  neighborhood?: string;        // text_mkv6a4x2
  borough?: string;             // text_mm27kbgc
  bblApn?: string;              // text_mkrd4ef
  latLong?: string;             // text_mkrdef32 (for Canvassing map)
  squareFeet?: number;          // numeric_mktv86gn
  totalUnits?: number;          // numeric_mkremqvd
  zoningCode?: string;          // text_mkrdw1gj
  reportedOwner?: string;       // text_mkv6q9j6
  lastSaleDate?: string;        // text_mkv6p6x3
  contactId?: Id;               // board_relation_mkswenwr → ContactsISG
  listingId?: Id;               // board_relation_mkrdbs0b → Listings
  pitchId?: Id;                 // board_relation_mkrebgeh → Pitch
}

// Exclusive Agreements · 18405710371
export interface ExclusiveAgreement {
  id: Id;
  name: string;                 // name
  eaStatus: "Draft Submitted" | "Approved"; // color_mm14e87t
  agreementType?: "Exclusive" | "Co-Exclusive" | "Open"; // color_mm14cjx2
  dealType?: "Lease" | "Sale" | "Lease & Sale" | "Debt Placement"; // color_mm16avh9
  sourcePipeline?: "Agency" | "Tenant" | "ISG" | "D&SF"; // dropdown_mm14bh0g
  listingId?: Id;               // board_relation_mm14y4yb
  ownerEntity?: string;         // text_mm14nrj8
  baseRatePct?: number;         // numeric_mm159zsp
  cbRatePct?: number;           // numeric_mm158f72
  startDate?: string;           // date_mm155h1y
  expDate?: string;             // date_mm15a1j
  mpApproverIds?: Id[];         // multiple_person_mm14na0s
  // AI-extracted (review before promote)
  aiStartDate?: string;         // text_mm158qfm
  aiExpDate?: string;           // text_mm151j8h
  aiTermLength?: string;        // text_mm15vdqc
  aiBaseRate?: string;          // text_mm15wx85
  aiCbRate?: string;            // text_mm155q48
  aiCbSplit?: string;           // text_mm15wxfs
  aiTailPeriod?: string;        // text_mm15xwpx
  aiOptionCommission?: string;  // text_mm15847x
}

export interface Activity {
  id: Id;
  entity: { board: string; itemId: Id };
  note: string;
  at: string; // ISO
  by?: string;
}

export interface ListingDetail extends Listing { leads: Lead[]; property?: Property; agreement?: ExclusiveAgreement; activity: Activity[]; }
export interface ContactDetail extends Contact { company?: Company; deals: Listing[]; activity: Activity[]; }
