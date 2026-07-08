/**
 * Verified column IDs + labels — mirror of docs/COLUMN-MAP.md (verified live 2026-07-06).
 *
 * This is the ONLY place raw column IDs live. Every read/write references these
 * constants. If a board changes, this file (and COLUMN-MAP.md) change — nothing else.
 *
 * ⚠️ The app writes VALUES into these columns only. It never creates/edits columns
 *    or labels. Every id/label here already exists on the live boards.
 */

export const BOARDS = {
  isgListings: 9262635626,
  properties: 9262635619,
  brokerProfiles: 18399686792,
  doneDeals: 18401124547,
  doneDealSubitems: 18401124549,
  arSchedules: 18401124599,
  contacts: 9262635615,
  leadsTracker: 9263596898,
} as const;

/**
 * Board-relation columns traversed to read the seller contacts individually
 * (Listing → Property → Contacts). Reading the linked contacts one by one avoids
 * the comma-joined owner mirrors, which mangle multi-owner deals. Verified 2026-07-08.
 */
export const REL = {
  listingToProperty: 'board_relation_mkrdxwqb', // ISG Listings → Properties (9262635619)
  propertyToContacts: 'board_relation_mkswenwr', // Properties → Contacts (9262635615)
  listingToLeads: 'board_relation_mkre1cj2', // ISG Listings → ISG Leads Tracker (9263596898)
} as const;

/**
 * ISG Leads Tracker (buyer funnel) — read for the winning-buyer picker; the ONLY
 * write is Status → LABELS.leadWinner on the chosen lead (verified live 2026-07-08).
 * Mirror columns come from the lead's Associated Contact; the Ai: columns are the
 * fallback when no contact is linked.
 */
export const LEAD = {
  status: 'status',
  offerPrice: 'numeric_mkrenrvk',
  offerDate: 'date4',
  contactRelation: 'board_relation_mkre9mpp',
  companyMirror: 'lookup_mkre301k',
  emailMirror: 'lookup_mm1sajx5',
  cellPhoneMirror: 'lookup_mm1s8928',
  aiName: 'text_mm1gdx2y',
  aiCompany: 'text_mm1g34em',
  aiEmail: 'email_mm1g43r4',
  aiPhone: 'phone_mm1gmzx9',
} as const;

/** Deal Stage labels on ISG Listings (status `deal_stage`). */
export const DEAL_STAGE = {
  closingReview: '5. Closing Review',
  doneDeal: 'xx. Done Deal',
} as const;

/** ISG Listings columns (read + write). */
export const ISG = {
  // status / gate
  dealStage: 'deal_stage',
  dealStatus: 'color_mkrdf2q8',
  sentToFinance: 'color_mkq1xfjf',
  houseDeal: 'color_mm2xcm3h',
  propertyTypeStatus: 'color_mkqys43g',
  isDevelopment: 'color_mkx4me60',
  isMultiProperty: 'color_mkx4xbcv',
  // dropdowns
  transactionType: 'dropdown_mm0s4phg',
  sourceType: 'dropdown_mm1aj3zt',
  coBroker: 'dropdown_mkrd8fa7',
  referral: 'dropdown_mkrdx5km',
  // numbers
  finalSalesPrice: 'numeric_mkrerp9p',
  scheduledCommission: 'numeric_mkrdp021',
  baseRate: 'numeric_mm164261',
  contractPrice: 'numeric_mm0smkhq',
  capRate: 'numeric_mm2wset5',
  commUnits: 'numeric_mm2w91as',
  totalUnits: 'numeric_mm2x5w9r',
  netToRipco: 'numeric_mm2xd4p8',
  concessions: 'numeric_mm2xby6n',
  coBrokerFeeDollars: 'numeric_mm2xfcs',
  referralFeeDollars: 'numeric_mm2xh9tz',
  // text
  resiUnits: 'text_mm2wy5f4',
  ownerEntity: 'text_mm16g57z',
  coBrokerPercentText: 'text_mm2wfv4x',
  referralPercentText: 'text_mm16sr80',
  coBrokerCo: 'text_mm2wrd9j',
  referralCo: 'text_mm2wzzyy',
  buyerName: 'text_mm2xyh46',
  buyerCompany: 'text_mm2xx91g',
  buyerEmail: 'text_mm2xfhw8',
  // long text
  transactionSummary: 'long_text_mm2wgx24',
  // date
  actualCloseDate: 'deal_close_date',
  // checkbox
  coBrokerPaidDirectly: 'boolean_mm2xvcra',
  referralPaidDirectly: 'boolean_mm2x2mgh',
  // mirrors (read-only source values)
  addressMirror: 'lookup_mks9s7wd',
  totalSfMirror: 'lookup_mksabzde',
  ownerNameMirror: 'lookup_mks9prrj',
  ownerCompanyMirror: 'lookup_mks9ac6s',
  emailMirror: 'lookup_mks9fv5t',
  officePhoneMirror: 'lookup_mks9f4yp',
  cellPhoneMirror: 'lookup_mm0shck8',
  // people
  lead: 'multiple_person_mkq8v3qn',
  team: 'multiple_person_mkq8e8cd',
  // files
  fileePsa: 'file_mm27jqv4',
  fileExclusiveAgreement: 'file_mm16gz6w',
  fileCoBrokerAgreement: 'file_mm27m5ge',
  fileReferralAgreement: 'file_mm27dh31',
  fileCommissionAgreement: 'file_mm2wm7k2',
  fileCoBrokerW9: 'file_mm27k83g',
  fileReferralW9: 'file_mm2xrm1n',
} as const;

/**
 * File slots shown on Step 1 (Documents) — unconditional docs only. Co-broker and
 * referral paperwork (agreements + W-9s) lives on the Deductions step and becomes
 * required when its toggle is Yes. Labels are UI-only (sentence case, RIPCO UI §0.1).
 */
export const FILE_SLOTS = [
  { id: 'psa', label: 'PSA', columnId: ISG.fileePsa, required: true },
  { id: 'ea', label: 'Exclusive agreement', columnId: ISG.fileExclusiveAgreement, required: true },
  { id: 'commissionAgreement', label: 'Commission agreement', columnId: ISG.fileCommissionAgreement, required: false },
] as const;

/** Done Deals columns (create_item) — corrected mapping. */
export const DD = {
  propertyAddress: 'text_mkzw3qc4',
  transactionType: 'text_mm1agpza',
  sellerName: 'text_mkzwvxbw',
  buyerName: 'text_mkzwgx7r',
  sellerCompany: 'text_mkzwymva',
  buyerCompany: 'text_mkzwym33',
  referrerCo: 'text_mkzwgdt4',
  coBrokerCo: 'text_mkzwdpqx',
  saleLoanAmount: 'numeric_mkzwm9ak',
  fullCommission: 'numeric_mkzwd8f8',
  grossCommission: 'numeric_mkzwm946',
  coBrokerFeeDollars: 'numeric_mkzz81dt',
  coBrokerFeePercent: 'numeric_mkzw8d8w',
  referralFeeDollars: 'numeric_mkzzpw9k',
  referralFeePercent: 'numeric_mkzwnb1s',
  concessions: 'numeric_mkzwe83r',
  netToRipco: 'numeric_mkzw6wzk',
  financeStatus: 'color_mkzwyj3y',
  coBroker: 'color_mkzwsj6w',
  referral: 'color_mkzwvfb6',
  houseDeal: 'color_mkzz155h',
  coBrokerPaidDirectly: 'boolean_mkzwxzng',
  referralPaidDirectly: 'boolean_mkzwxzbr',
  submissionDate: 'date_mkzwr2rc',
  closedDate: 'date_mkzw5npj',
  sourceType: 'dropdown_mkzwkeh8',
  sellerEmail: 'email_mkzw6r11',
  buyerEmail: 'email_mkzwnbe',
  dealNotes: 'long_text_mkzwm0s2',
  submittedBy: 'multiple_person_mkzwks1h',
  arRelation: 'board_relation_mkzwa1bn',
  sourceDealLink: 'board_relation_mkzzjbkt',
} as const;

/** Done Deal subitem columns (create_subitem). */
export const SUB = {
  brokerProfilesLink: 'board_relation_mm0v5cxj',
  participantType: 'color_mm0vztzw',
  splitType: 'color_mm0vvv6t',
  splitPercent: 'numeric_mm0vw3qc',
  receivesOriginationCredit: 'boolean_mm0vwff',
} as const;

/** A/R Schedules columns (create_item) — corrected mapping. */
export const AR = {
  paymentNumber: 'numeric_mkzwpbtq',
  scheduledAmount: 'numeric_mkzwkemz',
  clientName: 'text_mm1hxm5z',
  tenantBuyerBorrower: 'text_mm1h8f5s',
  doneDealRelation: 'board_relation_mm0vabds',
  dueDate: 'date_mkzwfznd',
  sourceType: 'dropdown_mm15b1ek',
} as const;

/** Contacts board (ISG CRM) — read-only lookup source (verified live 2026-07-06). */
export const CONTACT = {
  email: 'contact_email',
  cellPhone: 'phone_mktsq7p5',
  officePhone: 'contact_phone',
  role: 'text6',
  type: 'status',
  companyRelation: 'board_relation_mkskzf2a',
  companyText: 'text_mm3c5j1t',
} as const;

/** Done Deals billing columns (verified live 2026-07-06). */
export const DD_BILLING = {
  name: 'text_mm4ktvac',
  company: 'text_mm4k6zqv',
  address: 'text_mm4kb57f',
  phone: 'phone_mm4k19qa',
  email1: 'text_mm4kn634',
  email2: 'text_mm4khfpx',
  email3: 'text_mm4kbz8x',
  email4: 'text_mm4kxrb3',
} as const;

/** A/R Schedules billing columns (verified live 2026-07-06; emails are text type). */
export const AR_BILLING = {
  name: 'text_mm4khzqw',
  company: 'text_mm4k33zm',
  address: 'text_mm4kps0s',
  phone: 'phone_mm4knzdp',
  email1: 'text_mm4k2hfr',
  email2: 'text_mm4k8j46',
  email3: 'text_mm4k882s',
  email4: 'text_mm4kebs7',
} as const;

/** Broker Profiles columns. */
export const PROFILE = {
  activeStatus: 'color_mm12rset',
  mondayUser: 'multiple_person_mm12mw4w',
  team: 'text_mm3j8cvt',
} as const;

/** Status/participant labels used in writes (must match live labels exactly). */
export const LABELS = {
  participantOriginator: 'Originator',
  participantTeamMember: 'Team Member',
  splitHouseDeal: 'House Deal',
  splitTeamSplit: 'Team Split',
  financeNewSubmission: 'New Submission',
  /** Leads Tracker Status label marking the winning buyer (exists on the live board). */
  leadWinner: 'xx. Buyer',
  yes: 'Yes',
  no: 'No',
} as const;

/** House-deal principals — matched by name against Broker Profiles. */
export const HOUSE_DEAL_PRINCIPALS = ['Todd Cooper', 'Mark Kaplan', 'Peter Ripka'] as const;
export const HOUSE_DEAL_SPLIT = 16.66;
export const HOUSE_DEAL_REMAINDER = 83.34;

/** Property Type options (status labels on color_mkqys43g). */
export const PROPERTY_TYPES = [
  'Hotel', 'Multifamily', 'Condo/Townhouse', 'School', 'Land', 'Commercial',
  'Self Storage', 'Single Family', 'Retail', 'Student Housing', 'Mixed Use',
  'Development', 'Mixed-Use', 'Medical Office', 'Retail Condo', 'Industrial', 'Office',
] as const;

/** Transaction Type dropdown labels (dropdown_mm0s4phg). Write by label. */
export const TRANSACTION_TYPES = ['1031 Exchange', 'Note Sale', 'Ground Lease', 'Sale'] as const;

/** Source Type dropdown labels (dropdown_mm1aj3zt / dropdown_mkzwkeh8). */
export const SOURCE_TYPES = [
  'Debt & Structured Finance', 'iSales-Seller Rep', 'Retail-Agency', 'Retail-Tenant',
  'iSales-Buyer Rep', 'Consulting Assignment', 'Referral',
] as const;
