# ISG Done Deal Wizard — v2 Fixes & Enhancements

**Date:** 2026-07-08
**Status:** Approved (design) — pending spec review
**Author:** Claude Code + Adrian Mercado

## Context

The wizard is live via tunnel on the ISG Listings board. A live test ("Tyler Live Test",
item `12471574658`) failed at submit **Step 2 (Create Done Deal)**. Root cause: when a listing's
linked property has **more than one owner contact**, Monday returns the contact fields as a single
comma‑joined mirror string (e.g. name `"Adrian Mercado, Tyler Travis"`, phone
`"2035075484, 2305550999"`). The app dumped that whole string into one seller row; the multi‑number
phone was then sanitized to an invalid ~20‑digit number and Monday's phone column rejected the
`create_item`, failing the whole submit.

This spec fixes that root cause and bundles four related improvements requested at the same time.

## Goals

1. Correctly handle **multiple sellers** (read them as separate clean rows; write cleanly to Finance).
2. Simplify the **house‑deal** UX to a single toggle + a locked Principal row in Commission Splits.
3. Apply **number/currency formatting** and reorder the Deal Details fields.
4. Post a **full context snapshot** as a Monday Update on **both** the Listing and the Done Deal.
5. Write **Source Type** into each A/R Schedule item.

## Non‑goals

- **Location field** (`location_mm51sh4t` on Done Deals): **skipped.** Monday location columns require
  lat/lng; the app only has an address string, which already writes to Property Address text. Revisit
  later with geocoding if a map pin is wanted.
- No structural Monday changes (no new columns/labels). Values only, per project guardrails.

## Board / column reference (verified live 2026‑07‑08)

| Purpose | Board | ID |
|---|---|---|
| ISG Listings (source item) | ISG CRM | 9262635626 |
| Properties Database | ISG CRM | 9262635619 |
| Contacts | ISG CRM | 9262635615 |
| Done Deals | Finance | 18401124547 |
| Subitems of Done Deals | Finance | 18401124549 |
| A/R Schedules | Finance | 18401124599 |

Traversal for sellers: **Listing → Property → Contacts**
- ISG Listing → Property: `board_relation_mkrdxwqb` ("Property Record" → Properties 9262635619)
- Property → Contacts: `board_relation_mkswenwr` ("Contact Name" → Contacts 9262635615)
- Contact fields (from `columns.ts` `CONTACT`): name = item `name`; company = `text_mm3c5j1t`
  (fallback: `board_relation_mkskzf2a` display); email = `contact_email`; office phone =
  `contact_phone`; cell phone = `phone_mktsq7p5`.

A/R Source Type column: `dropdown_mm15b1ek` (labels identical to the 7 ISG/Done Deal source types).

---

## Feature 1 — Multiple sellers

### Read (prefill)
Replace the single comma‑joined seller prefill with per‑contact reads.

New function in `lib/donedeal/read.ts`, e.g. `readSellerContacts(listingId): Promise<PartyEntry[]>`:
1. Read the listing's Property Record relation (`board_relation_mkrdxwqb`) → property item id(s).
   Use the first linked property.
2. Read that property's Contact Name relation (`board_relation_mkswenwr`) → contact item ids.
3. Read each Contact (batch `items(ids: [...])`) → map to `PartyEntry` (name, company, email,
   phone = office phone or cell phone, entity blank).
4. Return the array; index 0 is the primary seller.

To minimize round‑trips, prefer `... on BoardRelationValue { linked_item_ids }` reads and one batched
`items(ids:[...])` for contacts. If `linked_items` (nested) is supported under API `2026-04`, a single
nested query may be used; otherwise up to two extra reads. This runs inside the existing prefill.

**Fallback:** if there is no property link, no contacts, or the reads fail, fall back to the current
mirror‑based single‑seller prefill (`prefillFromItem`). Never block the wizard on this.

Integration point: `App.tsx` init — when there is no saved draft, build sellers from
`readSellerContacts`; if it returns ≥1, use them; else use the existing mirror prefill. Buyers unchanged.

### Write
- Primary seller (index 0) → structured Client fields on the Done Deal, as today.
- `phoneVal` (in `submit.ts`) is hardened: extract the **first** run of digits that forms a valid
  US phone (10 digits, or 11 with leading 1); if none valid, return `undefined` so `prune` drops the
  key (send no phone rather than a bad one). This is the permanent guard against the original crash.
- All sellers are recorded in the full context snapshot (Feature 4).

### Acceptance criteria
- A listing whose property has 2 linked contacts prefills **2 separate seller rows**, each with one
  name and one clean phone.
- Submit succeeds; the Done Deal's Client phone is a single valid number.
- A listing with one contact behaves exactly as before.
- A listing with no property/contacts link still prefills a single seller from mirrors.

---

## Feature 2 — House‑deal redesign

### Current
`CommissionSplits.tsx` House Deal section has a Yes/No toggle **and** a "House deal principal" `Select`
with helper text; picking a principal inserts a locked broker row.

### New
- House Deal section = **only** the "Is this a house deal?" `YesNoToggle`. Remove the principal
  `Select` and its helper text from that section.
- On **Yes**: insert one locked Principal row at the top of **Commission Splits** with:
  - Broker field = a **dropdown of the 3 house‑deal principals** (`HOUSE_DEAL_PRINCIPALS`:
    Todd Cooper, Mark Kaplan, Peter Ripka), selecting `houseDealPrincipal` and resolving its profile id.
  - Participant type = locked to `Originator`.
  - Split % = locked to `HOUSE_DEAL_SPLIT` (16.66).
  - Row is non‑removable.
- On **No**: remove the locked Principal row; clear `houseDealPrincipal`.
- Brokers fill the remaining `HOUSE_DEAL_REMAINDER` (83.34%); splits still validate to 100%.

### State/logic
- `commission.houseDealPrincipal` is now chosen *in the locked row's dropdown* (not a separate widget).
- `setHouseDeal('Yes')` inserts an unselected locked Principal row (principal empty until chosen);
  changing the dropdown updates `houseDealPrincipal` and the row's `profileId`/`name`.
- `validateCommission`: when `isHouseDeal === 'Yes'`, require a principal selected (unchanged error).

### Acceptance criteria
- With House Deal = Yes, the only house‑deal control is the toggle; the Principal is selected from the
  locked row's dropdown (3 names), with type and split visibly locked.
- Submit writes the Originator/House‑Deal subitem for the chosen principal (as today).

---

## Feature 3 — Formatting + Deal Details order

### Formatted inputs (new primitives in `primitives.tsx`)
- `CurrencyInput`: displays USD (`$` + thousands, e.g. `$1,250,000`) when not focused; shows the raw
  number while focused; stores `number | null`. Reuses `money()` from `cn.ts` for display.
- `NumberInput` (thousands): displays grouped digits (`24,000`) when not focused; raw while focused.
- Behavior: format on blur / unfocus to avoid caret‑jump; parse strips `$ , %` on change.

### Applied to
- **USD:** Final Sales Price, Scheduled Commission, Contract Price (Deal Details); A/R payment amount
  fields in Commission Splits (consistency).
- **Thousands comma:** Total SF (Deal Metrics step).
- **Percent (unchanged):** Base Rate, split %, fee % stay plain numeric.

### Deal Details field order (`DealDetails.tsx`, 2‑col grid)
1. Property Address — full width
2. Transaction Type · Source Type
3. Final Sales Price · Contract Price
4. Base Rate (%) · Scheduled Commission
5. Actual Close Date · (empty)
6. Transaction Summary — full width

### Acceptance criteria
- The three money fields render as `$` currency; Total SF renders with commas; editing then blurring
  reformats; stored values remain numeric and submit unchanged.
- Deal Details fields appear in the order above.

---

## Feature 4 — Full context snapshot → both records

### Behavior
Add `buildContextSnapshot(form, wf, ...) : string` (in `submit.ts` or a new `snapshot.ts`) that renders
a sectioned plain‑text summary of everything entered:
- Deal details (address, transaction/source type, prices, base rate, scheduled commission, close date)
- Metrics (property type, total SF, cap rate, units, development/multi‑property)
- **All sellers** and **all buyers** (name, company, email, phone, entity)
- Billing contact (resolved)
- Deductions (co‑broker, referral — company, %, method)
- Commission waterfall (full/net/gross, fees, concessions) and **each broker split**
- A/R schedule (each payment # / amount / due date)
- Documents attached (labels)
- Deal notes

Post it as a Monday **Update** (`create_update`) on:
- the **ISG Listing** item — during/after Step 1, and
- the **Done Deal** item — during Step 2, after `createDoneDeal`.

This **replaces** `buildPartiesUpdate` (which only listed additional parties on the Done Deal).

**Snapshot posting is non‑fatal.** The structured column writes are the system of record; the Update is
a convenience snapshot. Each `create_update` call is wrapped in try/catch, logged on failure, and
**never fails its step or the submit** (a failed snapshot must not leave the wizard unable to finish
after the Done Deal already exists). Posted ids are held in `SubmitState` so a resume/retry does not
double‑post.

### Submit‑flow integration (`runSubmission`)
- Step 1: `updateListing`, then (best‑effort) post the snapshot update on the listing. Hold
  `listingUpdateId` in `SubmitState`.
- Step 2: `createDoneDeal`, then (best‑effort) post the snapshot update on the Done Deal (replacing the
  parties update). Rename `partiesUpdateId` → `doneDealUpdateId`.

### Acceptance criteria
- After a successful submit, both the Listing and the Done Deal have one Update containing the full,
  readable snapshot including every seller and buyer.
- Retry after a mid‑submit failure does not create duplicate updates.

---

## Feature 5 — A/R Source Type

- Add `AR.sourceType = 'dropdown_mm15b1ek'` to `columns.ts`.
- In `buildArItem` (`submit.ts`), write `sourceType` as `dropdownLabels(form.dealDetails.sourceType)`
  when a source type is set.

### Acceptance criteria
- Every A/R item created has Source Type set to the deal's source type.

---

## Files touched (anticipated)

- `lib/donedeal/read.ts` — `readSellerContacts` (traversal) + wire‑up.
- `lib/donedeal/columns.ts` — add `AR.sourceType`; (Contacts ids already present).
- `lib/donedeal/submit.ts` — harden `phoneVal`; `buildContextSnapshot`; A/R source type; snapshot
  posting + `SubmitState` fields.
- `lib/donedeal/compute.ts` — no math change expected (house‑deal split constants already exist).
- `components/steps/CommissionSplits.tsx` — house‑deal redesign; locked principal dropdown; currency
  on A/R amounts.
- `components/steps/DealDetails.tsx` — field reorder; currency inputs.
- `components/steps/DealMetrics.tsx` — Total SF thousands input.
- `components/steps/DealParties.tsx` — renders whatever seller rows prefill produces (mostly unchanged).
- `components/ui/primitives.tsx` — `CurrencyInput`, `NumberInput`.
- `App.tsx` — prefill sellers via `readSellerContacts` with fallback.
- Tests: extend `read.test.ts`, `submit.test.ts`, `compute.test.ts` for splitting, phone sanitize,
  snapshot, A/R source type, house‑deal principal row.

## Pre‑test cleanup (one‑off, not app code)

Reset "Tyler Live Test" (`12471574658`): Deal Stage → `5. Closing Review`; clear Deal Status and
Sent to Finance. Enables re‑testing.

## Testing

Via tunnel, on a throwaway listing in `5. Closing Review` whose property has **2 linked contacts**,
run all 7 steps as a **house deal**, submit, and verify across all Finance boards:
- Listing updated + snapshot update posted.
- Done Deal created with clean single Client phone + snapshot update posted.
- Participant subitems incl. locked principal (Originator / 16.66%).
- A/R items created with Source Type set.
Test with **one** item first (standing rule).

## Rollout

Changes flow through the active tunnel (dev server in `ISG-Done-Deal-App`); refresh the item view to
see them. To make permanent: `npm run mapps:push` + promote to Live.

---

## Addendum (2026-07-08, same day) — Broker lookup fix + Leads Tracker integration

### Feature 6 — Broker dropdown resilience (SHIPPED with this addendum)
Live Broker Profiles board (18399686792) has 5 placeholder rows with NO Active status set →
the Active-only filter emptied the dropdown. Fix: prefer Active-marked profiles, but when none
are marked, show ALL profiles instead of falling back to free text. Data task (Adrian/team):
replace placeholder rows with the real roster, set Active, link monday users.

### Feature 7 — ISG Leads Tracker integration (scope locked with Adrian)
Decisions: **Pull + close winner. Losing leads left untouched** (future board automation).

Board: ISG Leads Tracker **9263596898** (buyer funnel; linked to listings).
Verified columns: ISG Listing relation `board_relation_mkre94ze` (listing side:
`board_relation_mkre1cj2`), Associated Contact `board_relation_mkre9mpp`, mirrors —
Associated Company `lookup_mkre301k`, Email `lookup_mm1sajx5`, Cell Phone `lookup_mm1s8928`;
Ai fallbacks — name `text_mm1gdx2y`, company `text_mm1g34em`, email `email_mm1g43r4`,
phone `phone_mm1gmzx9`; Offer Price `numeric_mkrenrvk`, Offer Date `date4`, Status `status`.
Winner label **exists**: `xx. Buyer` → zero structure changes.

**Pull:** on load (non-blocking, like profiles) read the listing's linked leads →
`LeadOption { id, name, company, email, phone, offerPrice, offerDate, status }`
(mirror values preferred, Ai fields as fallback; sorted offers-first). If ≥1 lead, Deal
Parties → Buyers shows an optional "Winning buyer" Select; choosing one fills the primary
buyer card and stores `dealParties.winningLead { id, name, offerPrice, offerDate }`
(persisted in drafts). No leads → UI unchanged.

**Write-back:** in submit Step 2 (after Done Deal create): set the winning lead's Status →
`xx. Buyer`. Best-effort/non-fatal (same policy as snapshot updates), resume-safe via
`SubmitState.leadClosed`. Losing leads NOT touched. Offer Price/Date never overwritten.

**Snapshot:** includes a "Winning Lead" line (name + offer terms).

Acceptance: listing with linked leads shows the picker; selection prefills buyer; after
submit the lead reads `xx. Buyer`; a leads-write failure never blocks the submit; listing
without leads behaves exactly as before.
