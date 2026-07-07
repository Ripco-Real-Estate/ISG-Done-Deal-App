/** Yes/No used across metric + deduction toggles. */
export type YesNo = 'Yes' | 'No';

export type PaymentMethod = 'paid_at_closing' | 'paid_by_ripco' | '';

export type ParticipantType = 'Originator' | 'Team Member';

export interface BrokerEntry {
  /** Stable local key for React. */
  id: string;
  /** Broker Profiles item id (string). Empty until selected. */
  profileId: string;
  /** Fallback display name when no profile is matched (manual entry). */
  name: string;
  participantType: ParticipantType | '';
  /** Number stored as string for input binding. */
  splitPercent: string;
  /** True for the locked house-deal principal row (non-removable). */
  isHouseDealPrincipal?: boolean;
}

export interface PaymentRow {
  id: string;
  /** Dollar amount (ignored when multiplePayments = false — derived from Scheduled Commission). */
  amount: number;
  /** YYYY-MM-DD. Optional for single payment (falls back to Actual Close Date). */
  dueDate: string;
}

/** One seller or buyer. Index 0 in its array is the primary party. */
export interface PartyEntry {
  /** Stable local key for React. */
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  entity: string;
}

export function makeParty(id: string): PartyEntry {
  return { id, name: '', company: '', email: '', phone: '', entity: '' };
}

/** Who Finance invoices — written to the Done Deal and every A/R item. */
export interface BillingContact {
  /** While true, name/company/email1/phone derive live from the primary seller. */
  sameAsSeller: boolean;
  name: string;
  company: string;
  address: string;
  phone: string;
  email1: string;
  email2: string;
  email3: string;
  email4: string;
}

export interface UploadedFile {
  id?: string;
  name: string;
  url?: string;
}

export interface FormData {
  documents: {
    psa: UploadedFile[];
    exclusiveAgreement: UploadedFile[];
    coBrokerAgreement: UploadedFile[];
    referralAgreement: UploadedFile[];
    commissionAgreement: UploadedFile[];
    coBrokerW9: UploadedFile[];
    referralW9: UploadedFile[];
  };
  metrics: {
    propertyType: string;
    totalSf: number | null;
    capRate: number | null;
    resiUnits: string;
    commUnits: number | null;
    totalUnits: number | null;
    isDevelopment: YesNo;
    isMultiProperty: YesNo;
  };
  dealDetails: {
    address: string;
    transactionType: string;
    sourceType: string;
    finalSalesPrice: number | null;
    scheduledCommission: number | null;
    baseRate: number | null;
    contractPrice: number | null;
    actualCloseDate: string; // YYYY-MM-DD
    transactionSummary: string;
  };
  dealParties: {
    /** Index 0 = primary seller (feeds the structured Finance columns). */
    sellers: PartyEntry[];
    /** Index 0 = primary buyer. */
    buyers: PartyEntry[];
  };
  billing: BillingContact;
  deductions: {
    coBroker: YesNo;
    coBrokerCompany: string;
    coBrokerFeePercent: string;
    coBrokerPaymentMethod: PaymentMethod;
    referral: YesNo;
    referrerName: string;
    referralFeePercent: string;
    referralPaymentMethod: PaymentMethod;
    concessions: number;
  };
  commission: {
    isHouseDeal: YesNo;
    houseDealPrincipal: string;
    brokers: BrokerEntry[];
    paymentSchedule: PaymentRow[];
    multiplePayments: boolean;
  };
  /** Free-text notes to Finance (Step 7). */
  dealNotes: string;
}

export const INITIAL_FORM_DATA: FormData = {
  documents: {
    psa: [],
    exclusiveAgreement: [],
    coBrokerAgreement: [],
    referralAgreement: [],
    commissionAgreement: [],
    coBrokerW9: [],
    referralW9: [],
  },
  metrics: {
    propertyType: '',
    totalSf: null,
    capRate: null,
    resiUnits: '',
    commUnits: null,
    totalUnits: null,
    isDevelopment: 'No',
    isMultiProperty: 'No',
  },
  dealDetails: {
    address: '',
    transactionType: '',
    sourceType: '',
    finalSalesPrice: null,
    scheduledCommission: null,
    baseRate: null,
    contractPrice: null,
    actualCloseDate: '',
    transactionSummary: '',
  },
  dealParties: {
    sellers: [makeParty('seller-1')],
    buyers: [makeParty('buyer-1')],
  },
  billing: {
    sameAsSeller: true,
    name: '',
    company: '',
    address: '',
    phone: '',
    email1: '',
    email2: '',
    email3: '',
    email4: '',
  },
  deductions: {
    coBroker: 'No',
    coBrokerCompany: '',
    coBrokerFeePercent: '',
    coBrokerPaymentMethod: '',
    referral: 'No',
    referrerName: '',
    referralFeePercent: '',
    referralPaymentMethod: '',
    concessions: 0,
  },
  commission: {
    isHouseDeal: 'No',
    houseDealPrincipal: '',
    brokers: [],
    paymentSchedule: [{ id: 'payment-1', amount: 0, dueDate: '' }],
    multiplePayments: false,
  },
  dealNotes: '',
};

/** A broker profile from the Broker Profiles board. */
export interface Profile {
  id: string;
  name: string;
  active: boolean;
  /** monday user ids linked on the profile (for auto-match). */
  userIds: number[];
}

/** The loaded ISG Listings item, already coerced into plain values. */
export interface ListingItem {
  id: string;
  name: string;
  dealStage: string;
  /** Raw column value lookup by id → { text, value } for anything ad-hoc. */
  raw: Record<string, { text: string | null; value: string | null; displayValue?: string | null }>;
}
