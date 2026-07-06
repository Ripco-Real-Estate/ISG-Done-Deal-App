## ISG Done Deal Commission Wizard — Full Rebuild Specification - IMPORTANT   
## 1. Application Overview  
**Name:** ISG Done Deal Commission Wizard  
**Type:** monday.com Item View (installed on the ISG Listings board)  
**Purpose:** Guide brokers through a structured "Done Deal" submission when a listing closes. Collects documents, deal details, party information, deductions, metrics, and commission splits — then writes finalized data to three boards in the Finance Workspace.  
**Design Archetype:** Executive Enterprise — RIPCO Real Estate branding (Navy #1B2A4A primary, white backgrounds, clean card-based layouts)  
  
## 2. Board Architecture & Connections  
**2.1 Boards Involved**  

| Board | ID | Role | Access Method |
| ------------------------ | ----------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| ISG Listings | 9262635626 | Source board (installed board). Read item data, upload files, update columns at submission. | useItem() hook for reads, BoardSDK for writes and file uploads |
| BETA Profiles | 18399686792 | Broker directory. Provides dropdown options for commission participant selection. | Raw GraphQL via monday.api() — cannot use BoardSDK (context-bound to ISG Listings) |
| BETA Done Deals | 18401124547 | Target board. A new item is created here representing the finalized deal record. | Raw GraphQL via monday.api() with create_item mutation |
| BETA Done Deals Subitems | 18401124549 | Subitems board (auto-managed). Commission participants are created as subitems on the Done Deal item. | Raw GraphQL via monday.api() with create_subitem mutation |
| BETA A/R Schedules | 18401124599 | Payment tracking. One item per scheduled payment row. | Raw GraphQL via monday.api() with create_item mutation |
  
**2.2 Why Two Access Methods?**  
The Vibe SDK's BoardSDK class is **context-bound** to the board where the app is installed (ISG Listings 9262635626). Any attempt to use BoardSDK to query or write to a different board will either:  
* Return ISG Listings data (wrong data)  
* Silently fail on writes (column IDs don't match)  
* Throw "Unknown column" errors  
**Rule:** Use BoardSDK ONLY for ISG Listings operations. Use raw GraphQL via monday.api() for ALL cross-board operations (BETA Done Deals, BETA Profiles, BETA A/R Schedules).  
**2.3 Monday SDK Initialization**  
  
```
import mondaySdk from 'monday-sdk-js';  
const monday = mondaySdk();  

```
**Known Issue:** monday.api() may not be immediately available on first render. The app must:  
1. Check monday && typeof monday.api === 'function' before calling  
2. Set loading states to false in finally blocks to prevent infinite loading  
3. Never block the entire UI on profile loading — profiles are optional enhancement  
  
## 3. Data Flow Diagram  
  
```
┌─────────────────────────────────────────────────────────────┐  
│                     ISG Listings Board                       │  
│                      (9262635626)                            │  
│                                                              │  
│  useItem() hook ──────► item object (all columns)            │  
│  BoardSDK ◄──────────── file uploads, column updates         │  
└──────────────────────────────┬────────────────────────────────┘  
                               │  
                    ┌──────────▼──────────┐  
                    │   WIZARD APP STATE  │  
                    │                     │  
                    │  formData {         │  
                    │    documents,       │  
                    │    metrics,         │  
                    │    dealDetails,     │  
                    │    dealParties,     │  
                    │    deductions,      │  
                    │    commission       │  
                    │  }                  │  
                    │                     │  
                    │  profiles[]         │  
                    │  (from BETA         │  
                    │   Profiles board)   │  
                    └──────────┬──────────┘  
                               │  
              ┌────────────────┼────────────────┐  
              │                │                │  
              ▼                ▼                ▼  
┌─────────────────┐ ┌──────────────────┐ ┌──────────────────┐  
│  ISG Listings   │ │  BETA Done Deals │ │  BETA A/R        │  
│  (UPDATE)       │ │  (CREATE item +  │ │  Schedules       │  
│  BoardSDK       │ │   subitems)      │ │  (CREATE items)  │  
│                 │ │  monday.api()    │ │  monday.api()    │  
└─────────────────┘ └──────────────────┘ └──────────────────┘  

```
  
## 4. State Management  
**4.1 Form Data Schema**  
  
```
const INITIAL_FORM_DATA = {  
  documents: {  
    psa: [],                    // File[] from item.psa  
    exclusiveAgreement: [],     // File[] from item.exclusiveAgreementFile  
    coBrokerAgreement: [],      // File[] from item.cobrokerAgreement  
    referralAgreement: [],      // File[] from item.referralAgreement  
    commissionAgreement: []     // File[] from item.commissionAgreement  
  },  
  metrics: {  
    propertyType: '',           // Status label  
    totalSf: null,              // Number (EDITABLE — pre-filled from mirror)  
    capRate: null,              // Number  
    resiUnits: '',              // Text  
    commUnits: null,            // Number  
    totalUnits: null,           // Number (EDITABLE — auto-calc from resi+comm)  
    isDevelopment: 'No',        // 'Yes' | 'No'  
    isMultiProperty: 'No'       // 'Yes' | 'No'  
  },  
  dealDetails: {  
    address: '',                // Text (EDITABLE — pre-filled from mirror)  
    transactionType: '',        // Dropdown selection  
    sourceType: '',             // Dropdown selection  
    finalSalesPrice: null,      // Number  
    scheduledCommission: null,  // Number  
    baseRate: null,             // Number (%)  
    contractPrice: null,        // Number  
    actualCloseDate: '',        // 'YYYY-MM-DD'  
    transactionSummary: ''      // Long text  
  },  
  dealParties: {  
    seller: {  
      name: '',                 // Pre-filled from ownerName mirror  
      company: '',              // Pre-filled from ownerCompany mirror  
      email: '',                // Pre-filled from email mirror  
      phone: '',                // Pre-filled from officePhone/cellPhone mirror  
      entity: ''                // Pre-filled from ownerEntity text  
    },  
    buyer: {  
      name: '',                 // User-entered  
      company: '',              // User-entered  
      email: ''                 // User-entered  
    }  
  },  
  deductions: {  
    coBroker: 'No',             // 'Yes' | 'No'  
    coBrokerCompany: '',  
    coBrokerFeePercent: '',  
    coBrokerPaymentMethod: '',  // 'paid_at_closing' | 'paid_by_ripco'  
    coBrokerAgreementUploaded: false,  
    coBrokerW9Uploaded: false,  
    referral: 'No',             // 'Yes' | 'No'  
    referrerName: '',  
    referralFeePercent: '',  
    referralPaymentMethod: '',  
    referralAgreementUploaded: false,  
    referralW9Uploaded: false,  
    concessions: 0  
  },  
  commission: {  
    isHouseDeal: 'No',          // 'Yes' | 'No'  
    houseDealPrincipal: '',     // 'Todd Cooper' | 'Mark Kaplan' | 'Peter Ripka'  
    brokers: [],                // BrokerEntry[]  
    paymentSchedule: [          // PaymentRow[]  
      { id: 'payment-1', amount: 0 }  
    ],  
    multiplePayments: false  
  }  
};  

```
**4.2 Broker Entry Schema**  
  
```
{  
  id: 'broker-{timestamp}-{index}',  // Unique key  
  profileId: '',                      // Item ID on BETA Profiles board  
  participantType: '',                // 'Originator' | 'TeamMember'  
  splitPercent: ''                    // Number (string for input binding)  
}  

```
**4.3 Payment Row Schema**  
  
```
{  
  id: 'payment-{timestamp}-{index}',  
  amount: 0                           // Dollar amount  
}  

```
**4.4 Profile Object Schema (from BETA Profiles board)**  
  
```
{  
  id: '18399686792_itemId',           // Item ID on Profiles board  
  name: 'Adrian Mercado',             // Broker display name  
  column_values: [  
    {  
      id: 'color_mm12rset',           // Status column  
      text: 'Active'                  // Filter: only show 'Active' profiles  
    }  
  ]  
}  

```
**4.5 App-Level State**  
  
```
// Core data  
const [formData, setFormData] = useState(INITIAL_FORM_DATA);  
const [profiles, setProfiles] = useState([]);  
const [currentStep, setCurrentStep] = useState(1);  
  
// Loading flags  
const [profilesLoading, setProfilesLoading] = useState(false);  
const [isUploadingFile, setIsUploadingFile] = useState(false);  
const [uploadingSlot, setUploadingSlot] = useState(null);  
const [uploadingW9, setUploadingW9] = useState(null);  
const [uploadError, setUploadError] = useState(null);  
  
// From useItem hook  
const { item, loading: itemLoading, error: itemError, itemId, refetch } = useItem();  
  
// Board instance (for ISG Listings operations ONLY)  
const board = useMemo(() => new BoardSDK(), []);  

```
  
## 5. Persistence (Monday Storage API)  
**5.1 Draft Auto-Save**  
  
```
import { setStorage, getStorage, deleteStorage } from '@api/monday-storage';  
  
// Key format  
const draftKey = `donedeal_draft_${itemId}`;  
  
// Save (debounced, 2 seconds after last change)  
await setStorage(draftKey, JSON.stringify(formData));  
  
// Load (on app init, before pre-filling from item)  
const savedDraft = await getStorage(draftKey);  
if (savedDraft) {  
  setFormData(JSON.parse(savedDraft));  
}  
  
// Clear (after successful submission)  
await deleteStorage(draftKey);  

```
**5.2 Save Priority**  
1. Load saved draft from Monday Storage  
2. If no draft exists, pre-fill from item (useItem hook data)  
3. User edits override both  
4. Auto-save on every formData change (debounced)  
  
## 6. Gatekeeper Logic  
**6.1 Access Control**  
The wizard only activates when the listing's Deal Stage is "5. Closing Review".  
  
```
// Gate check  
if (item && item.dealStage !== '5. Closing Review') {  
  // Show gate screen with:  
  // - Message: "This listing must be in Closing Review stage"  
  // - Current stage badge  
  // - "Move to Closing Review" button (updates dealStage via BoardSDK)  
}  

```
**6.2 Post-Submit State**  
If item.dealStage === 'xx. Done Deal':  
* Show: "This deal has been submitted as a Done Deal."  
* Link to the Done Deal record (if available)  
* Do NOT show the wizard  
**6.3 Loading State Rules**  
  
```
// ONLY block on item not yet loaded — never on profiles  
if (itemLoading && !item && !isUploadingFile) {  
  return <LoadingScreen />;  
}  
  
// NEVER block on profilesLoading — profiles are optional  
// NEVER show loading screen during file uploads (isUploadingFile flag)  

```
  
## 7. Wizard Steps  
**7.1 Step Sequence**  

| Step | Name | Component | Purpose |
| ---- | ------------ | ---------------- | -------------------------------------------------------------------------- |
| 1 | Documents | DocumentUpload | Upload required/optional documents to ISG Listings file columns |
| 2 | Deal Metrics | DealMetrics | Property type, SF, units, cap rate, development/multi-property flags |
| 3 | Deal Details | DealDetails | Address, transaction type, financials, dates, summary |
| 4 | Deal Parties | DealParties | Seller info (pre-filled from mirrors), buyer info (user-entered) |
| 5 | Deductions | Deductions | Co-Broker/Referral toggles, fee calculations, agreement/W-9 uploads |
| 6 | Commission | CommissionSplits | House Deal toggle, broker split table, A/R payment schedule |
| 7 | Review | ReviewSubmit | Read-only summary, validation checklist, submit button, progress indicator |
  
**7.2 Navigation Rules**  
* Steps are numbered 1-7 in the header navigation bar  
* All 7 steps must be visible at all times without horizontal scrolling  
* "Next" button advances; "Back" button returns  
* **Step 7 has NO "Next" button** — the "Submit to Finance" button is the final action  
* Validation gates each step transition (user cannot proceed with missing required fields)  
  
## 8. Step Details  
**8.1 Step 1 — Documents**  
**Component:** DocumentUpload.jsx  
**Content:** Document upload slots ONLY. No financial fields.  

| Slot                 | Column ID     | SDK Property           | Required   |
| -------------------- | ------------- | ---------------------- | ---------- |
| PSA                  | file_mm27jqv4 | psa                    | ✅ Yes      |
| Exclusive Agreement  | file_mm16gz6w | exclusiveAgreementFile | ✅ Yes      |
| Co-Broker Agreement  | file_mm27m5ge | cobrokerAgreement      | ❌ Optional |
| Referral Agreement   | file_mm27dh31 | referralAgreement      | ❌ Optional |
| Commission Agreement | file_mm2wm7k2 | commissionAgreement    | ❌ Optional |
  
**Upload Handler:**  
  
```
const handleDocumentUpload = async (slot, file) => {  
  setIsUploadingFile(true);   // Prevents loading screen flash  
  setUploadingSlot(slot.id);  
  
  await board.item(itemId).uploadFile({  
    columnId: slot.columnId,  
    file  
  }).execute();  
  
  await refetch();             // Refresh item to show uploaded file  
  setUploadingSlot(null);  
  setIsUploadingFile(false);  
};  

```
**Validation:** PSA and Exclusive Agreement must be uploaded to proceed.  
**Pre-fill:** Detect existing files from item.psa, item.exclusiveAgreementFile, etc.  
  
**8.2 Step 2 — Deal Metrics**  
**Component:** DealMetrics.jsx  

| Field | Source | Editable | Type |
| ------------------ | ------------------------------------- | -------------- | ---------------------------------- |
| Property Type | item.propertyType1 (status) | ✅ Dropdown | Status label |
| Total SF | item.totalSf (mirror) | ✅ Number input | Pre-fill from mirror, allow edit |
| PPSF | Calculated: finalSalesPrice ÷ totalSf | ❌ Read-only | Auto-calculated |
| Cap Rate (%) | item.capRate | ✅ Number input | Percentage |
| Residential Units | item.resiUnits | ✅ Text input | Text (supports "N/A") |
| Commercial Units | item.commUnits | ✅ Number input | Number |
| Total Units | item.totalUnits or calculated | ✅ Number input | Auto-calc from resi+comm, editable |
| Is Development? | item.isDevelopment | ✅ Dropdown | Yes/No |
| Is Multi-Property? | item.isMultiproperty | ✅ Dropdown | Yes/No |
  
**Property Type Options:**  
  
```
const PROPERTY_TYPES = [  
  'Hotel', 'Multifamily', 'Condo/Townhouse', 'School', 'Land', 'Commercial',  
  'Self Storage', 'Single Family', 'Retail', 'Student Housing', 'Mixed Use',  
  'Development', 'Mixed-Use', 'Medical Office', 'Retail Condo', 'Industrial', 'Office'  
];  

```
**Total SF Pattern (same as Address):**  
* Pre-fill from mirror if available: item.totalSf?.displayValue  
* Render as EDITABLE number input  
* If mirror is empty, show empty input  
* User value overrides mirror value  
  
**8.3 Step 3 — Deal Details**  
**Component:** DealDetails.jsx  

| Field | Source | Editable | Column ID (ISG Listings) |
| ------------------------ | ------------------------ | ------------- | ----------------------------------- |
| Property Address | item.address (mirror) | ✅ Text input | Written to Done Deals text_mkzw3qc4 |
| Transaction Type | item.transactionType | ✅ Dropdown | dropdown_mm0s4phg |
| Source Type | item.sourceType | ✅ Dropdown | dropdown_mm1aj3zt |
| Final Sales Price | item.finalSalesPrice | ✅ Number | numeric_mkrerp9p |
| Scheduled Commission ($) | item.scheduledCommission | ✅ Number | numeric_mkrdp021 |
| Base Rate (%) | item.baseRate | ✅ Number | numeric_mm164261 |
| Contract Price | item.contractPrice | ✅ Number | numeric_mm0smkhq |
| Actual Close Date | item.actualCloseDate | ✅ Date picker | deal_close_date |
| Transaction Summary | item.transactionSummary | ✅ Text area | long_text_mm2wgx24 |
  
**Address Field Pattern:**  
* Pre-fill from item.address?.displayValue (mirror column)  
* Render as EDITABLE text input (NOT read-only)  
* Required — cannot proceed without it  
**Transaction Type Options:** '1031 Exchange', 'Note Sale', 'Ground Lease', 'Sale'  
**Source Type Options:** 'Debt & Structured Finance', 'iSales-Seller Rep', 'Retail-Agency', 'Retail-Tenant', 'iSales-Buyer Rep', 'Consulting Assignment', 'Referral'  
  
**8.4 Step 4 — Deal Parties**  
**Component:** DealParties.jsx  
**Seller Section (pre-filled from mirrors):**  

| Field | Source Mirror | SDK Property |
| ------- | --------------------------------- | -------------------------------------------------------------- |
| Name | lookup_mks9prrj | item.ownerName?.displayValue |
| Company | lookup_mks9ac6s | item.ownerCompany?.displayValue |
| Email | lookup_mks9fv5t | item.email?.displayValue |
| Phone | lookup_mks9f4yp / lookup_mm0shck8 | item.officePhone?.displayValue or item.cellPhone?.displayValue |
| Entity | text_mm16g57z | item.ownerEntity |
  
**Buyer Section (user-entered):**  

| Field   | Storage Key                        |
| ------- | ---------------------------------- |
| Name    | formData.dealParties.buyer.name    |
| Company | formData.dealParties.buyer.company |
| Email   | formData.dealParties.buyer.email   |
  
**8.5 Step 5 — Deductions**  
**Component:** Deductions.jsx  
**Financial Waterfall (calculated, displayed as summary):**  
  
```
Full Commission (Scheduled Commission $)  
  − Co-Broker Fee (if Co-Broker = Yes)  
  = Net to RIPCO  
  − Referral Fee (if Referral = Yes)  
  − Concessions  
  = Gross Commission (to be split among brokers)  

```
**Co-Broker Module (shown when Co-Broker = Yes):**  

| Field               | Type                                |
| ------------------- | ----------------------------------- |
| Co-Broker Toggle    | 'Yes' / 'No' dropdown               |
| Co-Broker Company   | Text input                          |
| Co-Broker Fee %     | Number input                        |
| Co-Broker Fee $     | Calculated (Full Commission × %)    |
| Payment Method      | 'Paid at Closing' / 'Paid by RIPCO' |
| Co-Broker Agreement | File upload → file_mm27m5ge         |
| Co-Broker W-9       | File upload → file_mm27k83g         |
  
**Referral Module (shown when Referral = Yes):**  

| Field | Type |
| --------------------- | ---------------------------------------------------------------- |
| Referral Toggle | 'Yes' / 'No' dropdown |
| Referrer Name/Company | Text input |
| Referral Fee % | Number input |
| Referral Fee $ | Calculated (Net to RIPCO × %) |
| Payment Method | 'Paid at Closing' / 'Paid by RIPCO' |
| Referral Agreement | File upload → file_mm27dh31 |
| Referral W-9 | File upload → file_mm2xrm1n (separate column from Co-Broker W-9) |
  
**W-9 Column Separation:**  
  
```
Co-Broker W-9 → file_mm27k83g (coBrokerW9)  
Referral W-9  → file_mm2xrm1n (referralW9)  

```
  
**8.6 Step 6 — Commission & Splits**  
**Component:** CommissionSplits.jsx  
**House Deal Logic**  
When **House Deal = Yes**:  
1. Show dropdown with THREE options: **Todd Cooper**, **Mark Kaplan**, **Peter Ripka**  
2. User selects ONE principal  
3. That ONE principal is added to the broker table as a **non-removable** row at **16.66%** with:  
    * Split Type = "House Deal"  
    * Participant Type = "Originator"  
4. The other two principals are **NOT added**  
5. Remaining allocation = **83.34%** for deal brokers  
6. No summary card or waterfall display for house deal math  
When **House Deal = No**:  
* Brokers must sum to **100%**  
* No principal row is added  
**Broker Selection Dropdown**  
**CRITICAL:** The broker dropdown MUST be a **native HTML **<select> element that maps over the profiles state array. Do NOT use any Vibe/shadcn component that auto-binds to a board.  
  
```
<select  
  value={broker.profileId || ''}  
  onChange={(e) => onUpdate('profileId', e.target.value)}  
  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"  
>  
  <option value="">Select a broker...</option>  
  {profiles  
    .filter(p => {  
      const status = p.column_values?.find(cv => cv.id === "color_mm12rset");  
      return status && status.text === "Active";  
    })  
    .map(p => (  
      <option key={p.id} value={p.id}>{p.name}</option>  
    ))  
  }  
</select>  

```
**Profile Loading (Raw GraphQL):**  
  
```
const query = `query {  
  boards(ids: [18399686792]) {  
    items_page(limit: 500) {  
      items {  
        id  
        name  
        column_values(ids: ["color_mm12rset"]) {  
          id  
          text  
        }  
      }  
    }  
  }  
}`;  
const response = await monday.api(query);  

```
**Auto-populate:** Match item.lead and item.team person names to profile names and pre-populate the broker table.  
**A/R Payment Schedule (in Step 6, NOT Step 7)**  

| Feature | Behavior |
| ------------------------ | -------------------------------------------------- |
| Default | 1 payment row = Full Scheduled Commission |
| Multiple Payments toggle | Reveals table with add/remove |
| Each row | Payment # (auto), Amount ($) input |
| Validation | Sum of all amounts must equal Scheduled Commission |
| Display | "Total: $X / $Y" with green ✓ when matched |
  
**Validation:** Step 6 cannot be completed unless:  
1. All brokers have profile + participant type + split %  
2. Split %s sum to 100% (or 83.34% for House Deals)  
3. A/R payment total equals Scheduled Commission  
  
**8.7 Step 7 — Review & Submit**  
**Component:** ReviewSubmit.jsx  
**A. Review Summary**  
Six collapsible sections, each with "Edit" link that navigates back to that step:  
1. **Documents** — Uploaded file names with ✓, missing required docs flagged red  
2. **Deal Metrics** — Property type, SF, PPSF, cap rate, units  
3. **Deal Details** — Address, transaction type, financials, dates  
4. **Deal Parties** — Seller and buyer info  
5. **Deductions** — Waterfall display, co-broker/referral details  
6. **Commission** — House deal status, broker table, A/R schedule summary  
**B. Document Validation Flags**  
  
```
If Co-Broker = Yes AND no Co-Broker Agreement → RED flag  
If Co-Broker = Yes AND no Co-Broker W-9 → RED flag  
If Referral = Yes AND no Referral Agreement → RED flag  
If Referral = Yes AND no Referral W-9 → RED flag  

```
**C. Deal Notes**  
Free text area for notes to Finance. Pre-fill from Transaction Summary if entered.  
**D. Validation Checklist**  
Display before submit button with ✓ (green) or ✗ (red) per condition:  
*  All required documents uploaded (PSA, EA)  
*  All conditional documents uploaded (Co-Broker/Referral agreements and W-9s)  
*  All required fields filled  
*  Commission split = 100% (or 83.34% + 16.66%)  
*  A/R payment total = Scheduled Commission  
**Submit button is LOCKED (disabled) until ALL conditions are met.**  
**E. Submit Actions (5-Step Sequential)**  
Show progress indicator with live status messages.  
**Sequential execution — stop on any failure.**  
  
## 9. Submission Write Operations  
**9.1 Step 1 of 5: Update ISG Listings**  
**Method:** BoardSDK (context-bound board — this is correct here)  
  
```
await board.item(itemId).update({  
  dealStage: 'xx. Done Deal',  
  dealStatus: 'Done Deal',  
  sentToFinance: 'Submitted',  
  finalSalesPrice: formData.dealDetails.finalSalesPrice,  
  scheduledCommission: formData.dealDetails.scheduledCommission,  
  contractPrice: formData.dealDetails.contractPrice,  
  actualCloseDate: new Date(formData.dealDetails.actualCloseDate),  
  transactionType: [formData.dealDetails.transactionType],  
  sourceType: [formData.dealDetails.sourceType],  
  coBroker: [formData.deductions.coBroker],  
  referral: [formData.deductions.referral],  
  coBroker1: formData.deductions.coBrokerFeePercent,  
  referralFee: formData.deductions.referralFeePercent,  
  cobrokerCo: formData.deductions.coBrokerCompany,  
  referralCo: formData.deductions.referrerName,  
  capRate: formData.metrics.capRate,  
  resiUnits: formData.metrics.resiUnits,  
  commUnits: formData.metrics.commUnits,  
  transactionSummary: formData.dealDetails.transactionSummary,  
  // NEW columns added to ISG Listings:  
  buyerName: formData.dealParties.buyer.name,  
  buyerCompany: formData.dealParties.buyer.company,  
  buyerEmail: formData.dealParties.buyer.email,  
  houseDeal: formData.commission.isHouseDeal,     // Status: Yes (id:1) / No (id:0)  
  netToRipco: calculatedNetToRipco,  
  concessions: formData.deductions.concessions,  
  referralPaidDirectly: formData.deductions.referralPaymentMethod === 'paid_at_closing',  
  referralFee1: calculatedReferralFee,  
  coBrokerPaidDirectly: formData.deductions.coBrokerPaymentMethod === 'paid_at_closing',  
  coBrokerFee: calculatedCoBrokerFee,  
  totalUnits: formData.metrics.totalUnits  
}).execute();  

```
**9.2 Step 2 of 5: Create Done Deal**  
**Method:** Raw GraphQL via monday.api()  
**Board:** 18401124547  
**Group:** "topics"  
**Column Value Mapping (BETA Done Deals):**  

| Column ID | Content | Format |
| ----------------------- | ----------------------------- | ----------------------------------- |
| text_mkzw3qc4 | Property Address | Plain string |
| text_mkzwdpqx | Transaction Type | Plain string |
| text_mkzwgdt4 | Seller Name | Plain string |
| text_mkzwgx7r | Buyer Name | Plain string |
| text_mkzwymva | Seller Company | Plain string |
| text_mkzwym33 | Buyer Company | Plain string |
| text_mm1agpza | Referrer Name | Plain string |
| numeric_mkzwm9ak | Final Sales Price | Raw number |
| numeric_mkzwd8f8 | Scheduled Commission | Raw number |
| numeric_mkzz81dt | Gross Commission (calculated) | Raw number |
| numeric_mkzwm946 | Cap Rate | Raw number |
| numeric_mkzw6wzk | Total Units | Raw number |
| color_mkzwyj3y | Submission Status | {"label": "New Submission"} |
| color_mkzwsj6w | Co-Broker | {"label": "Yes"} or {"label": "No"} |
| color_mkzwvfb6 | Referral | {"label": "Yes"} or {"label": "No"} |
| color_mkzz155h | House Deal | {"label": "Yes"} or {"label": "No"} |
| date_mkzwr2rc | Submission Date | {"date": "YYYY-MM-DD"} (today) |
| date_mkzw5npj | Close Date | {"date": "YYYY-MM-DD"} |
| dropdown_mkzwkeh8 | Source Type | {"ids": [numericId]} |
| email_mkzw6r11 | Seller Email | {"email": "addr", "text": "addr"} |
| email_mkzwnbe | Buyer Email | {"email": "addr", "text": "addr"} |
| boolean_mkzwxzng | Is Development | {"checked": "true"} (string!) |
| boolean_mkzwxzbr | Is Multi-Property | {"checked": "true"} (string!) |
| board_relation_mkzzjbkt | Link to ISG Listings | {"item_ids": [numericItemId]} |
  
**Source Type Dropdown ID Mapping:**  
  
```
const SOURCE_TYPE_IDS = {  
  'Debt & Structured Finance': 1,  
  'iSales-Seller Rep': 2,  
  'Retail-Agency': 3,  
  'Retail-Tenant': 4,  
  'iSales-Buyer Rep': 5,  
  'Consulting Assignment': 6,  
  'Referral': 7  
};  

```
**Mutation Pattern:**  
  
```
const columnValues = {  
  "text_mkzw3qc4": address,  
  "color_mkzwyj3y": {"label": "New Submission"},  
  // ... only include columns that have values  
};  
  
const columnValuesString = JSON.stringify(columnValues);  
  
const mutation = `mutation {  
  create_item(  
    board_id: 18401124547,  
    group_id: "topics",  
    item_name: ${JSON.stringify(itemName)},  
    column_values: ${JSON.stringify(columnValuesString)}  
  ) {  
    id  
    name  
  }  
}`;  
  
const response = await monday.api(mutation);  
const doneDealId = response.data.create_item.id;  

```
**CRITICAL RULES:**  
1. Only include columns that have actual values (skip empty strings, nulls, zeros)  
2. JSON.stringify(columnValues) creates the JSON string  
3. JSON.stringify(columnValuesString) escapes it for GraphQL  
4. DO NOT include file columns — Monday's API doesn't support file copying in create_item  
5. Never assign the same column ID twice in one object  
**9.3 Step 3 of 5: Create Commission Participants**  
**Method:** Raw GraphQL via monday.api()  
**Mutation:** create_subitem  
  
```
// For each broker in commission table:  
const subitemColumns = {  
  "color_mm0vztzw": {"label": participantType},     // "Originator" or "Team Member"  
  "color_mm0vvv6t": {"label": splitType},            // "House Deal" or "Team Split"  
  "numeric_mm0vw3qc": splitPercent,                  // Raw number  
  "boolean_mm0vwff": {"checked": isHouseDeal ? "false" : "true"},  
  "board_relation_mm0v5cxj": {"item_ids": [parseInt(profileId)]}  
};  
  
const mutation = `mutation {  
  create_subitem(  
    parent_item_id: ${doneDealId},  
    item_name: ${JSON.stringify(brokerName)},  
    column_values: ${JSON.stringify(JSON.stringify(subitemColumns))}  
  ) {  
    id  
  }  
}`;  

```
**House Deal principal:** Split Type = "House Deal", Origination Credit = false  
**Regular broker:** Split Type = "Team Split", Origination Credit = true  
**9.4 Step 4 of 5: Create A/R Schedule Items**  
**Method:** Raw GraphQL via monday.api()  
**Board:** 18401124599  
**Group:** "topics"  
  
```
// For each payment row:  
const arColumns = {  
  "numeric_mkzwpbtq": paymentNumber,      // 1, 2, 3...  
  "numeric_mkzwcxjf": totalPaymentCount,  // Total rows  
  "numeric_mkzwkemz": paymentAmount,      // Dollar amount  
  "text_mm1hr5fv": propertyAddress,  
  "text_mm1hxm5z": sellerName,  
  "text_mm1h8f5s": buyerName,  
  "board_relation_mkzwy71": {"item_ids": [parseInt(doneDealId)]}  
};  
  
const mutation = `mutation {  
  create_item(  
    board_id: 18401124599,  
    group_id: "topics",  
    item_name: ${JSON.stringify(`${address} — Payment ${n} of ${total}`)},  
    column_values: ${JSON.stringify(JSON.stringify(arColumns))}  
  ) {  
    id  
  }  
}`;  

```
**9.5 Step 5 of 5: Link A/R Records + Cleanup**  
**Method:** Raw GraphQL via monday.api()  
  
```
// Link all A/R items back to Done Deal  
const linkValue = {"item_ids": arItemIds.map(id => parseInt(id))};  
  
const mutation = `mutation {  
  change_column_value(  
    board_id: 18401124547,  
    item_id: ${doneDealId},  
    column_id: "board_relation_mkzwa1bn",  
    value: ${JSON.stringify(JSON.stringify(linkValue))}  
  ) {  
    id  
  }  
}`;  
  
// Clear draft from Monday Storage  
await deleteStorage(draftKey);  

```
  
## 10. Error Handling & Partial Success  
**10.1 Sequential Execution**  
Each step depends on the previous. If any step fails:  
1. **STOP** — do not proceed to next step  
2. **Show specific error** with the step that failed  
3. **Show what succeeded** with IDs if applicable  
4. **Offer "Retry"** button that resumes from the failed step  
**10.2 Partial Success Messages**  

| Failure Point | Message |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Step 1 fails | "Failed to update listing record. Please try again." |
| Step 2 fails | "Listing updated but Done Deal creation failed. Please try again." |
| Step 3 fails | "Done Deal created (ID: {id}) but commission participants failed. Click Retry to attempt participants again. You can also contact Adrian with Deal ID {id}." |
| Step 4 fails | "Done Deal and participants created, but A/R schedule failed. Click Retry for A/R only." |
| Step 5 fails | "All records created but linking failed. Contact Adrian with Deal ID {id}." |
  
**10.3 No Rollback**  
**Never delete or roll back partial records.** If a Done Deal was created but subitems failed, the Done Deal stays. The user can retry or contact Adrian to finish manually.  
  
## 11. Post-Submit Success Screen  
  
```
┌──────────────────────────────────────┐  
│          ✅ (animated checkmark)      │  
│                                      │  
│   Done Deal submitted successfully   │  
│                                      │  
│   Done Deal ID: 12345678             │ ← Clickable link (opens item card)  
│   Submitted for Finance review       │  
│                                      │  
│        [ Close ]                     │ ← Dismisses the app  
└──────────────────────────────────────┘  

```
* Stay on this screen (do NOT auto-close)  
* Done Deal ID is a clickable link  
* "Close" button dismisses  
  
## 12. File Structure  
  
```
src/generated/  
├── App.jsx                          # Entry point, state management, wizard shell  
├── theme-tokens.css                 # RIPCO branding tokens  
├── components/  
│   ├── WizardNavigation.jsx         # 7-step indicator bar (no scrolling)  
│   ├── DocumentUpload.jsx           # Step 1: File uploads only  
│   ├── DealMetrics.jsx              # Step 2: Property metrics  
│   ├── DealDetails.jsx              # Step 3: Financial details  
│   ├── DealParties.jsx              # Step 4: Seller/buyer info  
│   ├── Deductions.jsx               # Step 5: Co-broker, referral, concessions  
│   ├── CommissionSplits.jsx         # Step 6: Broker splits + A/R schedule  
│   └── ReviewSubmit.jsx             # Step 7: Review, validate, submit  
└── hooks/  
    └── (none currently needed)  

```
  
## 13. Design Tokens  
  
```
/* src/generated/theme-tokens.css */  
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');  
  
:root {  
  --font-heading: 'Manrope', sans-serif;  
  --font-body: 'Manrope', sans-serif;  
  
  /* Navy primary */  
  --primary: 222 47% 20%;          /* #1B2A4A */  
  --primary-foreground: 0 0% 100%;  
  
  /* Clean whites and grays */  
  --background: 0 0% 100%;  
  --foreground: 222 47% 11%;  
  --card: 0 0% 100%;  
  --card-foreground: 222 47% 11%;  
  --muted: 220 14% 96%;  
  --muted-foreground: 220 9% 46%;  
  --border: 220 13% 91%;  
  --ring: 222 47% 20%;  
  --accent: 220 14% 96%;  
  --accent-foreground: 222 47% 11%;  
  --destructive: 0 84% 60%;  
  
  --radius: 0.5rem;  
}  

```
  
## 14. Validation Rules by Step  

| Step | Required Fields | Validation |
| ---- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 1 | PSA uploaded, EA uploaded | item.psa?.length > 0 && item.exclusiveAgreementFile?.length > 0 |
| 2 | None required | All optional |
| 3 | Address, Transaction Type, Final Sales Price, Scheduled Commission, Base Rate, Close Date | Non-empty check |
| 4 | Seller Name, Buyer Name | Non-empty check |
| 5 | If Co-Broker=Yes: company, fee%, payment method | Conditional |
| 6 | All brokers: profile + type + split%; Splits sum to 100% (or 83.34%); A/R total = Scheduled Commission | Math validation |
| 7 | All above conditions met | Aggregate check |
  
## 15. Known Constraints & Gotchas from Monday Vibe that should be able to be handled with new build.  
1. **BoardSDK is context-bound** — only use for ISG Listings (9262635626)  
2. **monday.api() may be undefined on first render** — always check availability  
3. **File columns cannot be copied** between boards via create_item — files stay on ISG Listings, linked via board relation  
4. **Double-stringification** required for column_values in raw GraphQL mutations  
5. **Status column labels must match exactly** — "New Submission", not "new submission"  
6. **Checkbox columns use string "true"/"false"** — not boolean  
7. **Profile loading is non-blocking** — app must function without profiles (manual broker entry fallback)  
8. **Loading screen must never appear during file uploads** — use isUploadingFile flag  
9. **useItem() may trigger loading state on refetch** — check !item alongside itemLoading  
10. **Duplicate column assignments** in mutation objects cause GraphQL validation errors  
