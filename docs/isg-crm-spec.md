# ISG CRM — Product Specification & Board Schema

**A Lev-style product system for RIPCO's Investment Sales Group, built by Claude on top of the existing Monday.com "10. ISG CRM" workspace (server-side).**

Version 1.0 · Internal draft · June 2026
Owner: Adrian Mercado (amercado@ripcony.com) · Workspace: **10. ISG CRM** (`11163871`) — "RIPCO Investment Sales CRM & Pipeline"

> Scope of this document: (1) the product vision modeled on Lev, (2) the ISG CRM functional spec, and (3) the **live board schema** for the eight ISG CRM workspace boards — ContactsISG, Companies, My Lists, ISG Pitch Tracker, ISG Listings, ISG Leads Tracker, Properties Database, and Exclusive Agreements. All board IDs, column IDs, types, and status labels in §6 were pulled directly from the Monday account on June 23, 2026.

---

## 1. Product vision

Lev built a CRE-native **product system** — apps, agents, and data organized around the way capital-markets teams actually work — sitting on top of a structured deal/document data layer. The ISG CRM product applies the same pattern to RIPCO's Investment Sales Group:

- **Claude builds the application layer** — purpose-built screens (Pipeline, Contacts, Companies, Lists, Leads, Canvassing, EA review) that speak ISG's language (OM, BOV, EA, LOI, cap rate, NOI, PSF).
- **Monday.com stays the system of record (server-side).** The eight workspace boards below remain the database. The app reads and writes through the Monday API; AI columns, automations, and the audit trail stay on Monday.
- **Agents operate on the same data** — OM Extractor, LOI Comparison, EA Extractor (via Monday AI columns), Underwriting, Origination (+Zoom), Sales Comps (PropertyShark/ACRIS), and BOV Generator.

The CRM is the spine. Everything else — pitching, marketing, leads, offers, closing — hangs off the same contact, company, property, and deal records.

### 1.1 Lev → ISG mapping

| Lev surface | ISG CRM equivalent | Backing board(s) |
|---|---|---|
| Lev CRM | ISG Contacts + Companies | ContactsISG, Companies |
| Lev lists / segments | My Lists | My Lists |
| Lev Pipeline (pre-deal) | ISG Pitch Tracker | ISG Pitch Tracker |
| Lev Pipeline (live deals) | ISG Listings | ISG Listings |
| Lev Inbox / lead inbox | ISG Leads Tracker | ISG Leads Tracker |
| Lev Index / property data | Properties Database | Properties Database |
| Term-sheet / document extractor | EA Extractor (AI columns) | Exclusive Agreements |
| Lev knowledge graph | Board relations (the schema in §6/§7) | all 8 boards |

---

## 2. Personas & roles

- **Broker / Agent** — owns pitches, listings, contacts; works their scoped pipeline. Sees only deals they're tagged on (Lead / Team / Visibility person columns).
- **Team Lead / Managing Partner** — approves Exclusive Agreements (`Managing Partner Approver`), reviews office pipeline.
- **BOV Analyst** — fulfills BOV requests routed from the Pitch Tracker.
- **Marketing / GIS** — receives Setup & OM / BOV / marketing requests via the Marketing & GIS board (out of CRM scope but linked).
- **Admin / Ops** — manages boards, automations, and data hygiene.

Scoping rule (carried from ISG conventions): person-column filters use `["assigned_to_me"]`; never fall back to a full-board fetch when a scoped query returns zero — that means the broker isn't tagged.

---

## 3. Core objects & lifecycle

```
        ┌────────────┐      Company       ┌────────────┐
        │  Companies │◀───────────────────│ ContactsISG│
        └────────────┘                    └─────┬──────┘
                                                 │ My Lists / Properties / Deals
                                                 ▼
   ┌──────────────┐  Property Record  ┌────────────────────┐
   │  Properties  │◀──────────────────│  ISG Pitch Tracker │  (pre-listing: On Radar→BOV→Pitch→Win)
   │   Database   │                   └─────────┬──────────┘
   └──────┬───────┘                             │ Listing Won
          │ link to Deals Pipeline              ▼
          │                          ┌────────────────────┐   link to EA   ┌──────────────────────┐
          └─────────────────────────▶│    ISG Listings    │───────────────▶│ Exclusive Agreements │
                                      │ (live deal record) │                └──────────────────────┘
                                      └─────────┬──────────┘
                                                │ ISG Leads Tracker
                                                ▼
                                      ┌────────────────────┐
                                      │  ISG Leads Tracker │  (buyers/offers per listing)
                                      └────────────────────┘
```

**Deal lifecycle (left to right):**

1. **Prospect / canvass** → contact + property records exist in ContactsISG and Properties Database.
2. **Pitch** → a row on **ISG Pitch Tracker** (On Radar → BOV → Pitching Owner → Pitched → Negotiating Listing → **Listing Won**).
3. **Win → list** → promote to **ISG Listings**; require an **Exclusive Agreement** (EA Status = Uploaded/Approved unlocks marketing + Done Deal).
4. **Market & field interest** → buyers logged on **ISG Leads Tracker**, each connected to the listing (Outreach → Touring → Offers → Contract).
5. **Close** → Listing reaches Closing Review / Done Deal; commission + net-to-RIPCO captured.

---

## 4. Functional spec (CRM)

### 4.1 Contacts & Companies
- Contact record carries role **Type** (Owner, Investor, Attorney, Developer, Lender, Broker, User, Family Office, Private Equity), identity, phones/emails, and **Investor Criteria** (markets, property type, deal size min/max, condition, 1031 status, rating) for buy-side matching.
- Each contact links to a **Company** (parent-company hierarchy supported) and can connect to Properties, Lists, Leads, Pitches, and Listings.
- Activity (last contact, quick-call action, call notes, emails timeline) lives on the record.

### 4.2 My Lists
- Bottom-up, broker-built lists of **contacts and/or properties** for recurring outreach (Contact List / Property List / Deal Outreach List). Soft limit **750 contacts** per list; List Health formula flags hygiene.

### 4.3 Pitch Tracker (pre-listing)
- Captures pre-listing opportunities and BOV requests. Stage drives the pre-deal funnel; **Request BOV Analysis** routes to a BOV Analyst with estimated value and instructions; **Listing Won** promotes to ISG Listings.

### 4.4 Listings (live deals)
- The deal record: stage, price (listing/contract/final), commission, EA linkage, marketing linkage, and connected leads. **EA Status** gates marketing and Done Deal. Commission math (base rate, co-broker, referral, concessions, **Net to RIPCO**) is captured at close.

### 4.5 Leads Tracker
- Buyer/investor interest **scoped to a listing** (`ISG Listing` relation). Status funnel (Outreach → Interested → Touring → Expecting/Submitted/Accepted Offer → Contract). Offer economics (price, deposit, DD, contingencies, closing) support **LOI Comparison**. Inbound leads land via a form; "Add to Contacts?" promotes a lead into ContactsISG.

### 4.6 Exclusive Agreements
- Executed EA repository with **Monday AI columns** that extract term, dates, rates, CB split, tail period, and option commission from the uploaded PDF (the "EA Extractor" agent). MP approval flips EA Status to Approved and unlocks downstream steps.

### 4.7 Properties Database
- The shared property/ownership layer (9,240 records): location, physical, zoning/FAR, tax, ownership, units, NYC BBL/tax-map, and the **canvassing** source. Connects to Pitches, Listings, Contacts, and Lists.

---

## 5. Agents (operate on the boards)

| Agent | Reads | Writes / Output |
|---|---|---|
| **OM Extractor** | OM/rent roll/T-12 files | Property + financial fields → Properties / Listings |
| **EA Extractor** | EA File (PDF) | `AI:` columns on Exclusive Agreements |
| **LOI Comparison** | Leads Tracker offer fields | Ranked offer table + recommendation |
| **BOV Generator** | Pitch Tracker + comps | Estimated Value, BOV file link |
| **Sales Comp Agent** | PropertyShark/ACRIS + Properties | Comp set |
| **Underwriting** | Rent roll, T-12, comps | Base/stress underwriting |
| **Origination** | Contacts, Properties, Zoom | Ranked prospect list on Pitch Tracker |
| **Status Report** | Listings + Leads Tracker | Branded .docx |

---

## 6. Board schema (live, ISG CRM workspace `11163871`)

Legend — **type** uses Monday column types: `status` (colored label), `dropdown` (multi-label), `people`, `board_relation` (link to another board), `mirror` (read-only lookup through a relation), `formula`, `numbers`, `text`, `long_text`, `date`, `file`, `phone`, `email`, `rating`, `checkbox`, `creation_log`, `last_updated`, `item_id`. Columns marked **AI** are Monday AI-extraction columns. Mirrors are read-only.

---

### 6.1 ContactsISG — `9262635615`
*Item = "Contact" · 19,827 items · groups: My Contacts, New Group · views: My Contacts, Investor Criteria*

| Column | id | type | Notes |
|---|---|---|---|
| Name | `name` | name | Contact full name |
| First Name | `text_mkts6hew` | text | |
| Type | `status` | status | Owner · Investor · Attorney · Developer · Lender · Broker · User · Family Office · Private Equity · N/A |
| Role | `text6` | text | Job title / role |
| Company | `board_relation_mkskzf2a` | board_relation | → **Companies** `9526814002` |
| Cell Phone | `phone_mktsq7p5` | phone | |
| Office Phone | `contact_phone` | phone | |
| Ext | `text_mkw34s3a` | text | |
| Email | `contact_email` | email | |
| Additional Emails | `text_mkv51347` | text | |
| Other Phone | `phone_mm1dkapj` | phone | |
| Comments | `long_text4` | long_text | |
| Quick Call Action | `color_mkz6147g` | status | Call Note · DNA · LVM · Bad # |
| Call Note | `long_text_mkz6r0qk` | long_text | |
| Last Contact | `date_mkyrgsxr` | date | |
| My Lists | `board_relation_mkyr9tkm` | board_relation | → **My Lists** `9871281018` |
| Properties Database | `board_relation_mksw11tz` | board_relation | → **Properties** `9262635619` |
| Property Groups | `lookup_mkwkpwsa` | mirror | from Properties |
| ISG Leads Tracker | `board_relation_mkre5s3b` | board_relation | → **Leads Tracker** `9263596898` |
| link to ISG Leads Tracker | `board_relation_mm2pw9nd` | board_relation | → Leads Tracker (secondary) |
| Deals on Radar | `board_relation_mkqyymmb` | board_relation | → **Pitch Tracker** `9262635627` |
| Deals Pipeline | `board_relation_mkrgdm0c` | board_relation | → Listings `9262635626` + Pitch `9262635627` |
| Add to Leads Tracker | `button_mkwg8hr4` | button | Action button |
| Mailing Address / Unit / City / State / Zip | `text_mkrwhaw8` · `text_mkv5bm8s` · `text_mkrwvfa9` · `text_mkrwh483` · `text_mkrwx65c` | text | |
| Visibility | `people__1` | people | Scoping |
| Owner | `multiple_person_mm2027kc` | people | |
| **IC: Investor Rating** | `rating_mm3ckgz7` | rating | Buy-side criteria |
| **IC: Investor Condition** | `dropdown_mm3c1y00` | dropdown | Distressed · Rent Stab/Controlled · Note Sale · Owner/User · Free Market Only |
| **IC: Markets** | `dropdown_mm3c1vz5` | dropdown | Manhattan · LI · Westchester · Queens · Bronx · Brooklyn · Tampa Bay · Miami |
| **IC: Property Type** | `dropdown_mm3c5q3f` | dropdown | Industrial · Hospitality · Multifamily & Mixed Use · Retail · Office · Specialty · Development |
| **IC: Deal Size Min / Max ($)** | `numeric_mm3cyyxy` · `numeric_mm3c5fk9` | numbers | |
| **IC: 1031 Status** | `color_mm3cahj2` | status | Pre-Sale · 45-Day ID · 180-Day Close · Not in 1031 |
| **IC: Investor Verified?** | `color_mm3cd8rn` | status | Broker Verified · List Generation · AI Addition |
| IC: Crexi Lead Score | `text_mm3cfybp` | text | |
| IC: Criteria Notes | `long_text_mm3cw00n` | long_text | |
| reonomy_id / Foundry ID / owner_profile_link / Previous CRM link | `text_mkv5ybvd` · `text_mm137c67` · `text_mkv5yz31` · `text_mkv5qvhh` | text | Integration keys |
| Creation log / Last updated / Item ID | `pulse_log_mkv1e8x2` · `pulse_updated_mm00mqr4` · `pulse_id_mm0vs2y5` | system | |
| Subitems | `subtasks_mkv5wy83` | subtasks | |

---

### 6.2 Companies — `9526814002`
*Item = "Company" · 4,820 items · group: Companies*

| Column | id | type | Notes |
|---|---|---|---|
| Name | `name` | name | Company name |
| Parent Company | `board_relation_mm0vf5f5` | board_relation | → self (hierarchy) |
| Contacts | `board_relation_mksk3064` | board_relation | → **ContactsISG** `9262635615` |
| Type | `status` | status | Investor · Developer · Attorney · Broker · 3rd Party |
| URL | `company_domain` | link | Crunchbase auto-enrich |
| Company profile | `company_profile` | link | |
| Description | `company_description` | long_text | |
| Activities timeline | `custom_mkrm3gkw` | (timeline) | |
| Access | `multiple_person_mktsxf17` | people | |
| reonomy_property_id | `text_mkv6jjh0` | text | |
| Creation log | `pulse_log_mktswnbk` | creation_log | |
| Subitems | `subtasks_mm0tnz74` | subtasks | |

---

### 6.3 My Lists — `9871281018`
*Item = "List Name" · 67 items · group: All Lists · soft cap 750 contacts/list*

| Column | id | type | Notes |
|---|---|---|---|
| Name | `name` | name | List name |
| List Type | `color_mkyv2w79` | status | Contact List · Property List · Deal Outreach List · Other |
| List Description | `text_mkyrdgfc` | text | |
| Contacts & Properties | `board_relation_mkyrbn4c` | board_relation | → Contacts / Properties |
| # of Contacts | `lookup_mm2866j2` | mirror | Count |
| List Health | `formula_mm28xfpb` | formula | Hygiene indicator |
| Visibility | `person` | people | |
| Creation log | `pulse_log_mkyrgnen` | creation_log | |
| Subitems | `subtasks_mm07dvcr` | subtasks | |

---

### 6.4 ISG Pitch Tracker — `9262635627`
*Item = "Lead" · 681 items · groups: Waiting on Info, On Radar, BOV, Pitching Owner, Listing Won*

**Deal Stage (`lead_status`):** xx. Waiting on Info · 00. On Radar · 1. BOV · 2. Pitching Landlord · 3. Pitched · 4. Negotiating Listing · xx. Listing Won
**Deal Status (`color_mks92mj1`):** Active · Awaiting Decision · Warm Lead · On Hold · Dead

| Column | id | type | Notes |
|---|---|---|---|
| Name | `name` | name | |
| Deal Status | `color_mks92mj1` | status | see above |
| Deal Stage | `lead_status` | status | pre-listing funnel |
| Lead | `lead_owner` | people | Primary broker |
| Team | `multiple_person_mkv6hajg` | people | |
| Visibility | `multiple_person_mm0etn2t` | people | Scoping |
| Property Record | `board_relation_mkre6ypc` | board_relation | → **Properties** `9262635619` |
| Address / Contact Name / Company / Phone / Email / Property Type | `lookup_mks7n4a9` · `lookup_mks9zxgc` · `lookup_mks9z2cd` · `lookup_mks9fxa9` · `lookup_mks9twz2` · `lookup_mks9gaw5` | mirror | from Property |
| Listings Pipeline | `board_relation_mm06hq2x` | board_relation | → **ISG Listings** `9262635626` (on win) |
| Marketing & GIS Projects | `board_relation_mm2gwy7f` | board_relation | → `18389640392` |
| Request BOV Analysis | `color_mm1hwsbw` | status | Requested |
| BOV Analyst | `board_relation_mkreaqjj` | board_relation | → BOV board `8692377974` |
| BOV Status | `lookup_mkrezxdk` | mirror | from BOV board |
| BOV Point Person | `multiple_person_mkreveth` | people | |
| BOV File Link | `text_mksk5ktd` | text | |
| BOV Instructions | `long_text_mkre5tbb` | long_text | |
| Estimated Value | `numeric_mkqyhx4b` | numbers ($) | |
| Est. Commission ($) | `numeric_mkqyvhjh` | numbers ($) | |
| Transaction Type | `color_mks920y3` | status | Sale · Consulting · Paid BOV |
| Source Type | `dropdown_mm25x0qt` | dropdown | iSales-Seller/Buyer Rep · Retail-Agency/Tenant · D&SF · Consulting · Referral |
| Office | `color_mkxara9c` | status | Queens · Tampa · Miami · NJ · LI · NYC · Self Storage · Westchester-CT |
| Date of Assignment / Due Date | `date_mksk189f` · `date_mksk2tgn` | date | |
| Follow Up Note / Date / Priority | `text_mm1s1kch` · `date_mm1smvyk` · `color_mm1shfxv` | text/date/status | Critical→Low |
| Non Conversion Reason | `color_mm2kh2dr` | status | Hired other broker · Not selling · Pricing · Off-market · Informational |
| Deal Notes | `long_text_mkxbmds6` | long_text | |
| Creation log | `pulse_log_mkrewhfk` | creation_log | |
| Subitems | `subtasks_mkrv9rne` | subtasks | |

---

### 6.5 ISG Listings — `9262635626`
*Item = "Listing" · 257 items · groups: Waiting on Info, New to Pipeline, Pre-Marketing Phase, Listed, Contracts Out, In Contract, Closing Review*

**Deal Stage (`deal_stage`):** 00. New · 1. Preparing Materials · 2. Listed · 3. Contracts Out · 4.1 In Contract (DD) · 4.2 In Contract (Hard) · 5. Closing Review · xx. Done Deal · xx. Waiting on Info
**Deal Status (`color_mkrdf2q8`):** Active · On Hold · Dead · Done Deal · **EA Status (`color_mkq1pf8r`):** Uploaded · Upload Required

| Column | id | type | Notes |
|---|---|---|---|
| Name | `name` | name | |
| Deal Status | `color_mkrdf2q8` | status | |
| Deal Stage | `deal_stage` | status | live deal funnel |
| Transaction Type | `dropdown_mm0s4phg` | dropdown | Sale · 1031 Exchange · Note Sale · Ground Lease |
| Office | `color_mkx4mrgw` | status | Queens · Tampa · Miami · NJ · LI · NYC · Self Storage · Westchester-CT |
| EA Status | `color_mkq1pf8r` | status | Uploaded · Upload Required (gates marketing) |
| Sent to Finance | `color_mkq1xfjf` | status | |
| Lead / Team / Visibility | `multiple_person_mkq8v3qn` · `multiple_person_mkq8e8cd` · `multiple_person_mm0y6cw8` | people | Scoping |
| Property Record | `board_relation_mkrdxwqb` | board_relation | → **Properties** `9262635619` |
| Address / Property Type / Owner Name / Owner Company / Total SF / Phones / Email | `lookup_mks9s7wd` · `lookup_mkrd774g` · `lookup_mks9prrj` · `lookup_mks9ac6s` · `lookup_mksabzde` · `lookup_mks9f4yp` · `lookup_mm0shck8` · `lookup_mks9fv5t` | mirror | from Property |
| ISG Leads Tracker | `board_relation_mkre1cj2` | board_relation | → **Leads Tracker** `9263596898` |
| link to Exclusive Agreements | `board_relation_mm16ge45` | board_relation | → **EA** `18405710371` |
| Exclusive Agreement File | `file_mm16gz6w` | file | |
| Deals on Radar | `board_relation_mkrjgd7m` | board_relation | → Pitch Tracker |
| link to Marketing Requests Master | `board_relation_mm417ptg` | board_relation | → marketing |
| Listing Price | `numeric_mkrdb9pe` | numbers | |
| Contract Price | `numeric_mm0smkhq` | numbers | |
| Final Sales Price | `numeric_mkrerp9p` | numbers | |
| Scheduled Commission ($) | `numeric_mkrdp021` | numbers | |
| Base Rate % | `numeric_mm164261` | numbers | |
| Cap Rate | `numeric_mm2wset5` | numbers | |
| PPSF | `formula_mm2wsrs1` | formula | |
| Offers | `lookup_mm223fz0` | mirror | from Leads Tracker |
| Close Probability | `deal_close_probability` | formula | from stage |
| Expected / Actual Close Date | `deal_expected_close_date` · `deal_close_date` | date | |
| Date on Market | `date_mm0e4yz5` | date | |
| Co Broker / Referral | `dropdown_mkrd8fa7` · `dropdown_mkrdx5km` | dropdown | + `text` company/% fields |
| Buyer Name / Company / Email | `text_mm2xyh46` · `text_mm2xx91g` · `text_mm2xfhw8` | text | |
| Co Broker Fee $ / Referral Fee $ / Concessions / **Net to RIPCO** | `numeric_mm2xfcs` · `numeric_mm2xh9tz` · `numeric_mm2xby6n` · `numeric_mm2xd4p8` | numbers | |
| House Deal | `color_mm2xcm3h` | status | |
| Resi / Comm / Total Units | `text_mm2wy5f4` · `numeric_mm2w91as` · `numeric_mm2x5w9r` | text/numbers | |
| Transaction Summary | `long_text_mm2wgx24` | long_text | |
| Owner Entity | `text_mm16g57z` | text | |
| **AI: Listing Price / AI: Base Rate %** | `text_mm16wd0j` · `text_mm16dk0q` | text (AI) | AI extraction |
| PSA / Commission Agmt / Co-Broker Agmt / Referral Agmt / W9s | `file_mm27jqv4` · `file_mm2wm7k2` · `file_mm27m5ge` · `file_mm27dh31` · `file_mm27k83g` · `file_mm2xrm1n` | file | Closing docs |
| Source Type | `dropdown_mm1aj3zt` | dropdown | |
| Creation log / Last updated | `pulse_log_mkq1hg88` · `pulse_updated_mm00e9a2` | system | |

---

### 6.6 ISG Leads Tracker — `9263596898`
*Item = "Lead" · 473 items · groups: Inbound Leads, Interested Parties · form view "Add Lead"*

**Status (`status`):** 1. Outreach Made · 2. Interested · 3. Touring · 4.0 Expecting Offer · 4.1 Offer Submitted · 4.2 Offer Accepted · 5.1 Contract Out · 5.2 In Contract · xx. Buyer / Not Interested / Offer Rejected
**Phase (`color_mm0sz40y`):** Outreach · Touring · Offers · Contract Negotiation · Not Pursuing

| Column | id | type | Notes |
|---|---|---|---|
| Name | `name` | name | Lead/party name |
| ISG Listing | `board_relation_mkre94ze` | board_relation | → **ISG Listings** `9262635626` (required — every lead is listing-scoped) |
| Associated Contact | `board_relation_mkre9mpp` | board_relation | → **ContactsISG** `9262635615` |
| Associated Company | `lookup_mkre301k` | mirror | from Contact |
| Address / DOM / Team / Contract Price / Listing Price / Deal Stage | `lookup_mm2nkx5n` · `lookup_mm2neprr` · `lookup_mm2nmdv3` · `lookup_mm2nxws9` · `lookup_mm2nv9zw` · `lookup_mkys204c` | mirror | from Listing |
| Email / Cell Phone | `lookup_mm1sajx5` · `lookup_mm1s8928` | mirror | from Contact |
| Status | `status` | status | see above |
| Phase | `color_mm0sz40y` | status | see above |
| Interest Level | `color_mkwfw5tk` | status | High · Medium · Low |
| NDA | `color_mktzt79z` | status | In Progress · Signed · Not Signed · N/A |
| Tour Status / Tour Date | `color_mktzsdgv` · `date_mktz3x4m` | status/date | Need to schedule → Toured |
| Offer Date | `date4` | date | |
| Offer Price | `numeric_mkrenrvk` | numbers ($) | |
| Initial Deposit | `text_mm1spqmg` | text | |
| Closing Period | `text_mm1sc37v` | text | |
| Contingencies | `text_mm1syvx7` | text | |
| Due Diligence Period | `text_mm1s770a` | text | |
| Offer Docs | `file_mkrew93c` | file | |
| CoBroker? | `color_mksajebb` | status | Yes/No |
| Comments | `long_text_mkrew3tv` | long_text | |
| **Ai: Contact Name / Company / Email / Phone** | `text_mm1gdx2y` · `text_mm1g34em` · `email_mm1g43r4` · `phone_mm1gmzx9` | text/email/phone (AI) | inbound parsing |
| Add to Contacts? | `color_mm2nhzt5` | status | Yes → promote to ContactsISG |
| IB_Reminder Date | `date_mm2v8ds6` | date | |
| Owner / Visibility | `person` · `multiple_person_mm1cv4xy` | people | |
| Group Name | `formula_mkvndwvx` | formula | = linked listing name |
| Creation log / Last updated | `pulse_log_mkwhj84y` · `pulse_updated_mkwhfjtj` | system | |

---

### 6.7 Properties Database — `9262635619`
*Item = "Property" · 9,240 items · group: My Properties*

**Property Type (`color_mkrd2ax6`):** Hospitality · Mixed-Use · Land · Office · Multifamily · Retail · Industrial · Retail Condo · Agricultural · Portfolio · Self Storage · Specialty Use · 1-4 Family

| Column | id | type | Notes |
|---|---|---|---|
| Name | `name` | name | Property name |
| Property Type | `color_mkrd2ax6` | status | see above |
| Property Subtype | `text_mkv5d1ky` | text | |
| Address | `location` | location | |
| Street / City / State / Zip / Neighborhood / County | `text_mkrdj8pt` · `text_mkrdtzev` · `text_mkrddbc7` · `text_mkv61km0` · `text_mkv6a4x2` · `text_mkrdcng4` | text | |
| Geolocation (Lat/Long) | `text_mkrdef32` | text | |
| BBL/APN | `text_mkrd4ef` | text | |
| Borough / Block / Lot | `text_mm27kbgc` · `text_mm27hmdf` · `text_mm2793yj` | text | NYC |
| NYC Tax Map Link | `link_mm1h534e` | link | |
| Special Use District | `dropdown_mm3kejdr` | dropdown | NYC special districts (91 labels) |
| Square Feet | `numeric_mktv86gn` | numbers | |
| Lot Size | `text_mkrds69z` | text | |
| Building Height / Ceiling Height / No. of Stories | `text_mkrdw4kp` · `text_mkrd3jgk` · `numeric_mkreezda` | text/numbers | |
| Year Built / Renovated | `text_mkwhv8vd` · `text_mkrd8ba5` | text | |
| Construction Type / Building Class | `text_mkrdsb9v` · `text_mkrdrh57` | text | |
| Zoning Code / Use Type / FAR / Land Use Code / Special Designation | `text_mkrdw1gj` · `text_mkrdkdqd` · `text_mkrdxp5a` · `text_mkrdajjk` · `text_mkrd35nx` | text | |
| Total / Residential / Regulated / Commercial Units | `numeric_mkremqvd` · `numeric_mkre3z7` · `numeric_mkrem1pm` · `numeric_mkrerhz4` | numbers | |
| Asking/Sales Price | `text_mkrd52q7` | text | |
| Rent/SF/Yr (Avg.) | `numeric_mm213jkw` | numbers | |
| Tax Assessment / RE Taxes (Annual) | `text_mkrdkz1a` · `text_mkrdvpf6` | text | |
| Major Tenants / Tenant Type / Lease Term | `text_mkx471fc` · `text_mkx45wsx` · `text_mkx45czb` | text | |
| Sale Date / Reported Owner | `text_mkv6p6x3` · `text_mkv6q9j6` | text | |
| Owner | `multiple_person_mkwhz08j` | people | |
| Contact Name | `board_relation_mkswenwr` | board_relation | → **ContactsISG** `9262635615` |
| Company / Cell / Office Phone / Email / My Lists | `lookup_mkswraab` · `lookup_mm0ssgq` · `lookup_mkswya8b` · `lookup_mksw4h5h` · `lookup_mkwk7bts` | mirror | from Contact |
| link to Deals Pipeline | `board_relation_mkrdbs0b` | board_relation | → **ISG Listings** `9262635626` |
| ISG Pitch Tracker | `board_relation_mkrebgeh` | board_relation | → **Pitch Tracker** `9262635627` |
| link to My Lists | `board_relation_mkyv38f1` | board_relation | → My Lists |
| Add Portfolio Properties | `board_relation_mkwh1t5g` | board_relation | → self (portfolio) |
| Property Groups | `dropdown_mkvc3xd` | dropdown | FL county / size buckets |
| Photos / Floor Plans | `text_mkrdahbx` · `text_mkrd33jf` | text | links |
| reonomy_id / Foundry ID / owner_profile_link | `text_mkv5fm2h` · `text_mm19bka7` · `text_mkv56cqz` | text | Integration keys |
| Creation log | `pulse_log_mkv5eder` | creation_log | |

---

### 6.8 Exclusive Agreements — `18405710371`
*Item = "Agreement" · 108 items · group: Uploaded Agreements*

**EA Status (`color_mm14e87t`):** Draft Submitted (unlocks marketing) · Approved (unlocks Done Deal)
**Agreement Type (`color_mm14cjx2`):** Exclusive · Co-Exclusive · Open · **Deal Type (`color_mm16avh9`):** Lease · Sale · Lease & Sale · Debt Placement

| Column | id | type | Notes |
|---|---|---|---|
| Name | `name` | name | "{Address} — {Owner Entity}" |
| EA File | `file_mm142z92` | file | Executed PDF (AI source) |
| EA Status | `color_mm14e87t` | status | Draft Submitted · Approved |
| Agreement Type | `color_mm14cjx2` | status | Exclusive · Co-Exclusive · Open |
| Deal Type | `color_mm16avh9` | status | Lease · Sale · Lease & Sale · Debt Placement |
| Source Pipeline | `dropdown_mm14bh0g` | dropdown | Agency · Tenant · ISG · D&SF |
| Pipeline Deal | `board_relation_mm14y4yb` | board_relation | → **ISG Listings** `9262635626` |
| Managing Partner Approver | `multiple_person_mm14na0s` | people | Approver |
| Deal Team | `multiple_person_mm148pvy` | people | |
| Submission Date / Approval Date | `date_mm14cy45` · `date_mm14nkd3` | date | |
| EA Start Date / EA Exp Date | `date_mm155h1y` · `date_mm15a1j` | date | |
| Owner Entity | `text_mm14nrj8` | text | |
| Base Rate % / CB Rate % | `numeric_mm159zsp` · `numeric_mm158f72` | numbers (%) | |
| Commission Rate Type | `color_mm14fbn` | status | Tiered by Year · Flat · Flat w/ CB Differential · % of Sale · Custom |
| Commission Rate Schedule | `long_text_mm14220a` | long_text | |
| Co-Broker Commission Provision | `color_mm14k9qe` | status | None · RIPCO Pays Separately · Split Defined · Owner Pays CB Directly |
| Payment Schedule Detail | `long_text_mm14x3vt` | long_text | |
| Cancellation Terms | `long_text_mm14cwm1` | long_text | |
| Excluded Parties | `long_text_mm14stds` | long_text | |
| Special Rate Provisions | `long_text_mm145c1z` | long_text | |
| Referral Fee | `text_mm16kfqn` | text | |
| Approval Notes / EA Notes | `long_text_mm14tehe` · `long_text_mm143q8g` | long_text | |
| **AI: Agreement Name** | `text_mm15w3bg` | text (AI) | suggests item name |
| **AI: EA Start / Exp Date** | `text_mm158qfm` · `text_mm151j8h` | text (AI) | → date fields |
| **AI: Term Length** | `text_mm15vdqc` | text (AI) | |
| **AI: Base Rate % / CB Rate % / CB Split %** | `text_mm15wx85` · `text_mm155q48` · `text_mm15wxfs` | text (AI) | |
| **AI: Tail Period** | `text_mm15xwpx` | text (AI) | post-expiration protection (days) |
| **AI: Option Commission** | `text_mm15847x` | text (AI) | Yes/No/Partial |

---

## 7. Relationship map (ER summary)

| From board | Relation column | To board |
|---|---|---|
| ContactsISG | Company `board_relation_mkskzf2a` | Companies |
| ContactsISG | My Lists `board_relation_mkyr9tkm` | My Lists |
| ContactsISG | Properties Database `board_relation_mksw11tz` | Properties |
| ContactsISG | ISG Leads Tracker `board_relation_mkre5s3b` | Leads Tracker |
| ContactsISG | Deals on Radar `board_relation_mkqyymmb` | Pitch Tracker |
| ContactsISG | Deals Pipeline `board_relation_mkrgdm0c` | Listings + Pitch |
| Companies | Contacts `board_relation_mksk3064` / Parent `board_relation_mm0vf5f5` | ContactsISG / self |
| My Lists | Contacts & Properties `board_relation_mkyrbn4c` | Contacts / Properties |
| Pitch Tracker | Property Record `board_relation_mkre6ypc` | Properties |
| Pitch Tracker | Listings Pipeline `board_relation_mm06hq2x` | Listings |
| Pitch Tracker | BOV Analyst `board_relation_mkreaqjj` | BOV board `8692377974` |
| Pitch Tracker | Marketing & GIS `board_relation_mm2gwy7f` | `18389640392` |
| ISG Listings | Property Record `board_relation_mkrdxwqb` | Properties |
| ISG Listings | ISG Leads Tracker `board_relation_mkre1cj2` | Leads Tracker |
| ISG Listings | link to Exclusive Agreements `board_relation_mm16ge45` | Exclusive Agreements |
| ISG Listings | Marketing Requests Master `board_relation_mm417ptg` | marketing |
| Leads Tracker | ISG Listing `board_relation_mkre94ze` | Listings |
| Leads Tracker | Associated Contact `board_relation_mkre9mpp` | ContactsISG |
| Properties | link to Deals Pipeline `board_relation_mkrdbs0b` | Listings |
| Properties | ISG Pitch Tracker `board_relation_mkrebgeh` | Pitch Tracker |
| Properties | Contact Name `board_relation_mkswenwr` | ContactsISG |
| Exclusive Agreements | Pipeline Deal `board_relation_mm14y4yb` | Listings |

---

## 8. Permissions, AI, and audit

- **Scoped visibility** via person columns (Lead / Team / Visibility on Pitch, Listings, Leads; Visibility/Access/Owner on Contacts/Companies/Properties). The app inherits Monday permissions; it never widens access.
- **AI columns** are the extraction surface: EA (`text_mm15…` set), Listings (`AI: Listing Price`, `AI: Base Rate %`), and Leads inbound parsing (`Ai: …`). Extracted values stay reviewable against the source file before promotion.
- **Audit:** every write posts a structured `create_update` to the parent item (per ISG Assistant protocol) so board history stays complete.

## 9. Non-goals (v1)

- Not migrating data off Monday — Monday stays server-side.
- ISG only — Retail/D&SF CRMs are separate workspaces (`xx. Retail CRM` `11490289`, `9. D&SF CRM` `11163795`).
- Marketing fulfillment (Marketing & GIS board `18389640392`) is linked, not rebuilt here.

## 10. Rollout

1. **Read-only lens** — render Contacts, Companies, Lists, Pitch, Listings, Leads, Properties from live boards.
2. **Write-back + AI agents** — create/update records; ship EA Extractor, OM Extractor, LOI Comparison, Status Reports.
3. **Outreach + advanced agents** — Inbox (M365), Mass Email, Campaigns (HubSpot), Underwriting, Origination (+Zoom), Sales Comps, BOV.
4. **Default surface** — ISG brokers default into the app; Monday boards become the admin/backstage view.

---

*Schema verified against the live Monday account (workspace 11163871) on 2026-06-23. Column IDs are stable identifiers; titles and labels reflect current board configuration and may evolve.*
