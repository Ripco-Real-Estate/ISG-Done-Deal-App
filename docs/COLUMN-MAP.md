# Verified Column Map — Done Deal Wizard

**Verified live 2026-07-06** via monday API against the 5 boards. This is the **single source
of truth**. It supersedes the source spec wherever they conflict. Mirrored in code at
`src/lib/donedeal/columns.ts` — keep the two in sync.

> ⚠️ **Do not change board structure.** Every ID/label below already exists. The app writes
> values into these columns; it never creates or edits columns or labels.

## Boards

| Board | ID | Access |
|---|---|---|
| ISG Listings (installed) | 9262635626 | read item; write values + file uploads |
| Broker Profiles | 18399686792 | read Active profiles (dropdown source) |
| Done Deals | 18401124547 | create item |
| Subitems of Done Deals | 18401124549 | create_subitem (participants) |
| A/R Schedules | 18401124599 | create items + link back |

---

## ISG Listings (9262635626)

### Read — source columns

| Field | Column ID | Type | Notes |
|---|---|---|---|
| Deal Stage (gate) | `deal_stage` | status | gate = "5. Closing Review"; submitted = "xx. Done Deal" |
| Property Type (status) | `color_mkqys43g` | status | labels match PROPERTY_TYPES list |
| Total SF (mirror) | `lookup_mksabzde` | mirror | pre-fill, editable |
| Cap Rate | `numeric_mm2wset5` | numbers | |
| Resi Units | `text_mm2wy5f4` | text | supports "N/A" |
| Comm Units | `numeric_mm2w91as` | numbers | |
| Total Units | `numeric_mm2x5w9r` | numbers | |
| Is Development? | `color_mkx4me60` | status | labels No / Yes |
| Is Multi-Property? | `color_mkx4xbcv` | status | labels No / Yes |
| Address (mirror) | `lookup_mks9s7wd` | mirror | pre-fill, editable |
| Transaction Type | `dropdown_mm0s4phg` | dropdown | ids 2–5 → write by LABEL |
| Source Type | `dropdown_mm1aj3zt` | dropdown | ids 1–7 |
| Final Sales Price | `numeric_mkrerp9p` | numbers | |
| Scheduled Commission | `numeric_mkrdp021` | numbers | |
| Base Rate % | `numeric_mm164261` | numbers | |
| Contract Price | `numeric_mm0smkhq` | numbers | |
| Actual Close Date | `deal_close_date` | date | |
| Transaction Summary | `long_text_mm2wgx24` | long_text | |
| Owner Name (mirror) | `lookup_mks9prrj` | mirror | seller name |
| Owner Company (mirror) | `lookup_mks9ac6s` | mirror | seller company |
| Email (mirror) | `lookup_mks9fv5t` | mirror | seller email |
| Office Phone (mirror) | `lookup_mks9f4yp` | mirror | seller phone |
| Cell Phone (mirror) | `lookup_mm0shck8` | mirror | seller phone (fallback) |
| Owner Entity | `text_mm16g57z` | text | |
| Lead (people) | `multiple_person_mkq8v3qn` | people | broker auto-match |
| Team (people) | `multiple_person_mkq8e8cd` | people | broker auto-match |

### File columns (upload targets on the listing)

| Slot | Column ID | Required |
|---|---|---|
| PSA | `file_mm27jqv4` | ✅ |
| Exclusive Agreement | `file_mm16gz6w` | ✅ |
| Co-Broker Agreement | `file_mm27m5ge` | optional |
| Referral Agreement | `file_mm27dh31` | optional |
| Commission Agreement | `file_mm2wm7k2` | optional |
| Co-Broker W-9 | `file_mm27k83g` | conditional |
| Referral W-9 | `file_mm2xrm1n` | conditional |

### Write — at submission (values only)

| Field | Column ID | Type | Write as |
|---|---|---|---|
| Deal Stage | `deal_stage` | status | `{label:"xx. Done Deal"}` |
| Deal Status | `color_mkrdf2q8` | status | `{label:"Done Deal"}` |
| Sent to Finance | `color_mkq1xfjf` | status | `{label:"Submitted"}` |
| Final Sales Price | `numeric_mkrerp9p` | numbers | raw number |
| Scheduled Commission | `numeric_mkrdp021` | numbers | raw number |
| Contract Price | `numeric_mm0smkhq` | numbers | raw number |
| Actual Close Date | `deal_close_date` | date | `{date:"YYYY-MM-DD"}` |
| Transaction Type | `dropdown_mm0s4phg` | dropdown | `{labels:["Sale"]}` |
| Source Type | `dropdown_mm1aj3zt` | dropdown | `{labels:[...]}` |
| Co-Broker? | `dropdown_mkrd8fa7` | dropdown | `{labels:["Yes"]}` (Yes=1/No=2) |
| Referral? | `dropdown_mkrdx5km` | dropdown | `{labels:["Yes"]}` (No=1/Yes=2 — write by label) |
| Co-Broker % | `text_mm2wfv4x` | text | string |
| Referral Fee % | `text_mm16sr80` | text | string |
| Co-Broker Co. | `text_mm2wrd9j` | text | |
| Referral Co. | `text_mm2wzzyy` | text | |
| Cap Rate | `numeric_mm2wset5` | numbers | |
| Resi Units | `text_mm2wy5f4` | text | |
| Comm Units | `numeric_mm2w91as` | numbers | |
| Total Units | `numeric_mm2x5w9r` | numbers | |
| Transaction Summary | `long_text_mm2wgx24` | long_text | |
| Buyer Name | `text_mm2xyh46` | text | |
| Buyer Company | `text_mm2xx91g` | text | |
| Buyer Email | `text_mm2xfhw8` | text | |
| House Deal | `color_mm2xcm3h` | status | `{label:"Yes"/"No"}` |
| Net to RIPCO | `numeric_mm2xd4p8` | numbers | calc |
| Concessions | `numeric_mm2xby6n` | numbers | |
| Referral Paid Directly? | `boolean_mm2x2mgh` | checkbox | `{checked:"true"}` |
| Referral Fee $ | `numeric_mm2xh9tz` | numbers | calc |
| Co-Broker Paid Directly? | `boolean_mm2xvcra` | checkbox | `{checked:"true"}` |
| Co-Broker Fee $ | `numeric_mm2xfcs` | numbers | calc |

---

## Done Deals (18401124547) — create_item, group "topics"

> **These are the CORRECTIONS.** The source spec §9.2 mismapped many of these.

| Field | Column ID | Type | Source-spec said | Correction |
|---|---|---|---|---|
| Property Address | `text_mkzw3qc4` | text | ✓ same | |
| Transaction Type | `text_mm1agpza` | text | `text_mkzwdpqx` ❌ | that ID is "Co Broker Co." |
| Seller/Client Name | `text_mkzwvxbw` | text | `text_mkzwgdt4` ❌ | that ID is "Referrer Co." |
| Buyer Name (TLB) | `text_mkzwgx7r` | text | ✓ same | |
| Seller/Client Company | `text_mkzwymva` | text | ✓ same | |
| Buyer Company (TLB) | `text_mkzwym33` | text | ✓ same | |
| Referrer Co. | `text_mkzwgdt4` | text | `text_mm1agpza` ❌ | swapped w/ Transaction Type |
| Co-Broker Co. | `text_mkzwdpqx` | text | — | available |
| Sale/Loan Amount | `numeric_mkzwm9ak` | numbers | Final Sales Price ✓ | |
| Full Commission | `numeric_mkzwd8f8` | numbers | Scheduled Commission ✓ | |
| Gross Commission | `numeric_mkzwm946` | numbers | `numeric_mkzz81dt` ❌ | that ID is "Co-Broker Fee $" |
| Co-Broker Fee $ | `numeric_mkzz81dt` | numbers | — | |
| Co-Broker Fee % | `numeric_mkzw8d8w` | numbers | — | |
| Referral Fee $ | `numeric_mkzzpw9k` | numbers | — | |
| Referral Fee % | `numeric_mkzwnb1s` | numbers | — | |
| Concessions | `numeric_mkzwe83r` | numbers | — | |
| Net to RIPCO | `numeric_mkzw6wzk` | numbers | Total Units ❌ | that ID is "Net to RIPCO" |
| Finance/Submission Status | `color_mkzwyj3y` | status | ✓ `{label:"New Submission"}` | |
| Co-Broker? | `color_mkzwsj6w` | status | ✓ `{label:"Yes"/"No"}` | |
| Referral? | `color_mkzwvfb6` | status | ✓ `{label:"Yes"/"No"}` | |
| House Deal? | `color_mkzz155h` | status | ✓ `{label:"Yes"/"No"}` | |
| Co-Broker Paid Directly? | `boolean_mkzwxzng` | checkbox | Is Development ❌ | that ID is paid-directly |
| Referral Paid Directly? | `boolean_mkzwxzbr` | checkbox | Is Multi-Property ❌ | that ID is paid-directly |
| Submission Date | `date_mkzwr2rc` | date | ✓ `{date: today}` | |
| Closed Date | `date_mkzw5npj` | date | ✓ `{date:...}` | |
| Source Type | `dropdown_mkzwkeh8` | dropdown | ✓ write by label | |
| Seller/Client Email | `email_mkzw6r11` | email | ✓ `{email,text}` | |
| Buyer Email (TLB) | `email_mkzwnbe` | email | ✓ | |
| Deal Notes | `long_text_mkzwm0s2` | long_text | — | notes to Finance |
| Submitted By | `multiple_person_mkzwks1h` | people | — | current user id |
| A/R relation | `board_relation_mkzwa1bn` | board_relation | ✓ (step 5) | |
| Source Deal Link → ISG | `board_relation_mkzzjbkt` | board_relation | ✓ `{item_ids:[listingId]}` | boardIds incl. 9262635626 |

**Not available on Done Deals** (write to ISG Listings only, omit from Done Deal):
Cap Rate, Total Units, Is Development, Is Multi-Property. (Source spec tried to put these
here; no such columns exist on this board.)

---

## Subitems of Done Deals (18401124549) — create_subitem

| Field | Column ID | Type | Write as |
|---|---|---|---|
| Broker Profiles link | `board_relation_mm0v5cxj` | board_relation | `{item_ids:[profileId]}` (boardIds incl. 18399686792) |
| Participant Type | `color_mm0vztzw` | status | `{label:"Originator"/"Team Member"}` |
| Split Type | `color_mm0vvv6t` | status | `{label:"House Deal"/"Team Split"}` |
| Split % | `numeric_mm0vw3qc` | numbers | raw number |
| Receives Origination Credit? | `boolean_mm0vwff` | checkbox | `{checked:"true"/"false"}` |

House-deal principal → Split Type "House Deal", origination credit false, 16.66%.
Regular broker → Split Type "Team Split", origination credit true.

---

## A/R Schedules (18401124599) — create_item, group "topics"

> Source spec §9.4 had 3 wrong/absent IDs; corrected below.

| Field | Column ID | Type | Source-spec said | Correction |
|---|---|---|---|---|
| Payment # | `numeric_mkzwpbtq` | numbers | ✓ | |
| Scheduled Amount | `numeric_mkzwkemz` | numbers | ✓ (paymentAmount) | |
| Client / Seller Name | `text_mm1hxm5z` | text | ✓ | |
| Tenant / Buyer / Borrower | `text_mm1h8f5s` | text | ✓ (buyerName) | |
| Due Date | `date_mkzwfznd` | date | — | `{date:"YYYY-MM-DD"}` — optional; single payment falls back to Actual Close Date (verified live 2026-07-06) |
| Done Deal link | `board_relation_mm0vabds` | board_relation | `board_relation_mkzwy71` ❌ | that ID does not exist |
| ~~Total payment count~~ | — | — | `numeric_mkzwcxjf` ❌ | column does not exist → drop, encode in item name |
| ~~Property Address~~ | — | — | `text_mm1hr5fv` ❌ | no such text col; auto-mirrors via `lookup_mm34mjrv` |

Item name: `"{address} — Payment {n} of {total}"`.

**Step 5 link-back:** on the Done Deal item, set `board_relation_mkzwa1bn` (Done Deals →
A/R Schedules) to `{item_ids:[...arItemIds]}`. Both directions covered.

---

## Billing columns (verified live 2026-07-06)

Written at submission from the wizard's Billing contact section (values only).

### Done Deals (18401124547)

| Field | Column ID | Type | Write as |
|---|---|---|---|
| Billing Contact Name | `text_mm4ktvac` | text | string |
| Billing Contact Company | `text_mm4k6zqv` | text | string |
| Billing Address | `text_mm4kb57f` | text | string |
| Billing Phone | `phone_mm4k19qa` | phone | `{phone:"digits", countryShortName:"US"}` |
| Billing Email 1–4 | `text_mm4kn634` / `text_mm4khfpx` / `text_mm4kbz8x` / `text_mm4kxrb3` | text | string |

### A/R Schedules (18401124599) — written on every A/R item

| Field | Column ID | Type | Write as |
|---|---|---|---|
| Billing Contact Name | `text_mm4khzqw` | text | string |
| Billing Contact Company | `text_mm4k33zm` | text | string |
| Billing Address | `text_mm4kps0s` | text | string |
| Billing Phone | `phone_mm4knzdp` | phone | `{phone:"digits", countryShortName:"US"}` |
| Billing Email 1–4 | `text_mm4k2hfr` / `text_mm4k8j46` / `text_mm4k882s` / `text_mm4kebs7` | text | string |

---

## Contacts (9262635615) — READ-ONLY lookup source (verified live 2026-07-06)

Name-contains search (`items_page` rule on `name`, `contains_text`, min 2 chars) powering
the ContactLookup fast-fill. This app never writes to this board.

| Field | Column ID | Type |
|---|---|---|
| Email | `contact_email` | email |
| Cell Phone | `phone_mktsq7p5` | phone |
| Office Phone | `contact_phone` | phone |
| Role | `text6` | text |
| Type | `status` | status |
| Company (relation) | `board_relation_mkskzf2a` | board_relation — read `display_value` |
| Company (text fallback) | `text_mm3c5j1t` | text |

---

## Broker Profiles (18399686792)

| Field | Column ID | Type | Notes |
|---|---|---|---|
| Active Status | `color_mm12rset` | status | filter `text === "Active"` |
| Monday User | `multiple_person_mm12mw4w` | people | match to current user / Lead / Team |
| Team | `text_mm3j8cvt` | text | |

Query: `boards(ids:[18399686792]){ items_page(limit:500){ items { id name column_values(ids:["color_mm12rset"]){ id text } } } }`

House-deal principals to match by name: **Todd Cooper, Mark Kaplan, Peter Ripka**.

---

## Addendum — verified live 2026-07-08 (wizard v2)

### Relation traversal (read-only)
| Purpose | Board | Column ID |
|---|---|---|
| Listing → Property Record | ISG Listings | `board_relation_mkrdxwqb` |
| Property → Contact Name | Properties (9262635619) | `board_relation_mkswenwr` |
| Listing → ISG Leads Tracker | ISG Listings | `board_relation_mkre1cj2` |

### A/R Schedules (18401124599) — added
| Column | ID | Notes |
|---|---|---|
| Source Type | `dropdown_mm15b1ek` | Same 7 labels as ISG/Done Deals. Written on every A/R item. |

### ISG Leads Tracker (9263596898) — read + ONE write
| Column | ID | Notes |
|---|---|---|
| Status | `status` | ONLY write: label `xx. Buyer` on the winning lead (label exists — never create labels) |
| Offer Price | `numeric_mkrenrvk` | read |
| Offer Date | `date4` | read |
| Associated Contact | `board_relation_mkre9mpp` | read |
| Associated Company (mirror) | `lookup_mkre301k` | read |
| Email (mirror) | `lookup_mm1sajx5` | read |
| Cell Phone (mirror) | `lookup_mm1s8928` | read |
| Ai: Contact Name / Company / Email / Phone | `text_mm1gdx2y` / `text_mm1g34em` / `email_mm1g43r4` / `phone_mm1gmzx9` | read fallbacks |
