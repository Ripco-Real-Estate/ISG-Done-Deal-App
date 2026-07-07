# Design — Parties, Billing, A/R Dates & Document Requiredness

**Date:** 2026-07-06 · **Approved by:** Adrian (chat, this date)
**Scope:** "Plan B" — contact lookup, multiple sellers/buyers, billing contact, A/R due
dates, conditional document requiredness. UX polish items (context strip, drafts UI,
error lists, success copy, already-submitted link) are a separate follow-on plan.

## Non-negotiables (inherited)

- Values-only writes. **No board/column/label creation or edits, ever.** `create_update`
  (posting an update on an item) is a value write and is allowed.
- `docs/COLUMN-MAP.md` is law; `src/lib/donedeal/columns.ts` mirrors it — change both
  together. All new column IDs below were **verified live 2026-07-06** via API.
- Write status/dropdowns by label text. Profiles never block UI. Submit remains
  sequential, stop-on-failure, no rollback, resume-safe.
- Structured Client/TLB columns on Done Deals feed **automated invoicing** downstream.
  They must contain the PRIMARY party only — never concatenations.

---

## 1. `ContactLookup` component (new UI primitive)

Type-ahead input over the ISG CRM **Contacts** board (`9262635615`).

- **Trigger:** no search until ≥ 2 characters typed; then debounced ~300 ms.
- **Query:** `boards(ids:[9262635615]) { items_page(limit: 8, query_params: { rules:
  [{ column_id: "name", compare_value: ["<term>"], operator: contains_text }] }) ... }`
  reading: item `id`, `name`, Email `contact_email`, Cell `phone_mktsq7p5`, Office
  `contact_phone`, Role `text6`, Type `status`, Company — prefer the board-relation
  `board_relation_mkskzf2a` `display_value`, fall back to text `text_mm3c5j1t`.
- **Result rows:** name · company · type pill. Keyboard + click select.
- **Select = fast-fill:** copies name/company/email/phone into the party card. Fields
  remain editable after fill. No linkage is stored (Done Deals has no Contacts relation
  column and we cannot add one).
- **Free-text fallback:** typing without selecting is always valid.
- **Never creates contacts** (that's the isg-intake skill's job).
- **Mock mode (`?mock=1`):** returns canned `MOCK_CONTACTS`; zero API calls.
- Errors: lookup failures degrade silently to free-text (search is a convenience, never
  a blocker). RIPCO-UI: popover list, hairline borders, no `position:fixed`.

## 2. Multiple sellers & buyers (Step 4 — Deal parties)

**Form model** (`types.ts`):

```ts
interface PartyEntry { id: string; name: string; company: string; email: string;
  phone: string; entity: string }
dealParties: { sellers: PartyEntry[]; buyers: PartyEntry[] }   // index 0 = primary
```

(One `PartyEntry` type for both sides, for uniformity. Buyer cards render only
name/company/email — as today — so a buyer's `phone`/`entity` simply stay `''`.)

- **UI:** cards labeled **Primary seller / Primary buyer**; "Add another seller" /
  "Add another buyer" buttons append removable cards ("Seller 2", "Buyer 2", …). Every
  card gets `ContactLookup` + the same fields as the primary.
- **Prefill:** primary seller from listing mirrors (unchanged); buyers start with one
  empty primary card.
- **Draft migration:** `loadDraft` must detect the old `{seller, buyer}` object shape
  and wrap into arrays so existing drafts survive the model change.

**Submit mapping:**

- Primary seller/buyer → the existing structured columns, byte-for-byte as today
  (ISG buyer text cols; DD Client/TLB name/company/email; A/R client/tenant names).
- Additional parties → **no columns touched**. One update posted on the Done Deal item
  via `create_update`, plain text:

  ```
  Additional parties (from Done Deal wizard)
  Sellers:
    2) <name> — <company> · <email> · <phone> · <entity>
  Buyers:
    2) <name> — <company> · <email>
  ```

  Built by a pure `buildPartiesUpdate(form): string | null` (null when no additional
  parties → no update posted).
- **Sequencing/resume:** posted inside submit step 2 immediately after Done Deal
  creation. `SubmitState` gains `partiesUpdateId: string | null`; step 2 is complete
  only when item + (needed) update both exist. On retry: `doneDealId` set → skip
  create; `partiesUpdateId` set → skip update. Never double-creates either.

**Validation (`validateParties`):** primary seller name + primary buyer name required
(unchanged rule, new shape). Any additional card must have a non-empty name
("Every additional party needs a name — or remove it.").

## 3. A/R payment due dates (Step 6)

- `PaymentRow` gains `dueDate: string` (YYYY-MM-DD, '' = unset). Date input beside each
  amount.
- **Single payment (`multiplePayments = No`):** due date **optional**; UI pre-fills
  from Actual Close Date; if still empty at submit, write falls back to
  `actualCloseDate`. Amount is **derived live from Scheduled Commission** — the row no
  longer stores a copy (fixes the stale-amount bug: compute/validation/build treat
  single-payment mode as `[{amount: scheduledCommission}]`).
- **Multiple payments:** due date **required on every row** (`validateCommission` adds
  the check).
- **Write:** A/R create payload adds `date_mkzwfznd` (**Due Date**, verified) as
  `{date: "YYYY-MM-DD"}`. Item name format unchanged.

## 4. Billing contact (Step 4, below Buyer)

Purpose: drives invoicing; lands on both Finance boards.

- **Fields:** Contact name, Company, Address, Phone, Email 1–4.
- **"Same as primary seller" toggle:** while ON → name/company/email/phone derive live
  from the primary seller card and inputs are disabled (address + emails 2–4 stay
  editable since the seller card has no address). Turn OFF to edit freely.
  `ContactLookup` available when OFF.
- **Form model:** `billing: { sameAsSeller: boolean; name; company; address; phone;
  email1; email2; email3; email4 }`.
- **Validation (required):** name, company, address, phone, email1. Emails 2–4 optional.
- **Writes** (all verified live 2026-07-06):
  - Done Deal create payload: `text_mm4ktvac` name · `text_mm4k6zqv` company ·
    `text_mm4kb57f` address · `phone_mm4k19qa` phone (`{phone, countryShortName:"US"}`)
    · `text_mm4kn634`/`text_mm4khfpx`/`text_mm4kbz8x`/`text_mm4kxrb3` emails 1–4.
  - Every A/R item create payload: `text_mm4khzqw` name · `text_mm4k33zm` company ·
    `text_mm4kps0s` address · `phone_mm4knzdp` phone · `text_mm4k2hfr`/`text_mm4k8j46`/
    `text_mm4k882s`/`text_mm4kebs7` emails 1–4. (A/R email columns are `text` type —
    plain strings.)

## 5. Document requiredness (Steps 1 & 5)

Rule: **a document is required exactly when its trigger is on.**

- **Step 1** keeps only unconditional docs: PSA (required), Exclusive agreement
  (required), Commission agreement (optional). The duplicated co-broker/referral
  agreement slots are **removed** from Step 1 (`FILE_SLOTS` trimmed); footnote says
  co-broker/referral paperwork is collected on Deductions when applicable.
- **Step 5:** Co-broker = Yes → Co-broker agreement + Co-broker W-9 slots show
  **Required** pills and `validateDeductions` blocks Next until both uploaded. Same for
  Referral (agreement + W-9). `FileSlot` gains a `required` prop usage driven by the
  toggle state.
- `documentFlags` (Review-time flags) is **removed**; its four checks move into
  `validateDeductions`, so problems surface on the step where they're fixable.
  `allValid` drops the flags term.

## 6. Plumbing & constants

`columns.ts` + `COLUMN-MAP.md` updated **together**:

- `BOARDS.contacts = 9262635615`; new `CONTACT` block (email/phones/company/role/type
  IDs above).
- `AR.dueDate = 'date_mkzwfznd'`; `DD_BILLING` and `AR_BILLING` blocks per §4.
- `FILE_SLOTS` per §5.

## 7. Mock mode

- `mockForm()` migrates to the new shapes (arrays, billing, dueDate).
- `MOCK_CONTACTS` (~6 entries) back `ContactLookup`.
- Submit simulation unchanged; no API calls anywhere under `?mock=1`.

## 8. Testing

Pure-function unit tests (Vitest, existing style):

- `buildPartiesUpdate`: none/one/many additional parties; formatting; null when none.
- `buildDoneDeal`: billing columns present; primary-only party columns; unchanged
  legacy fields.
- `buildArItem`: dueDate written; close-date fallback; billing columns present;
  derived single-payment amount.
- Validators: parties (primary/additional), billing required set, commission due-date
  rule, deductions doc requirements.
- Draft migration: old `{seller, buyer}` draft loads into new array shape.
- Submit resume: step-2 retry with `doneDealId`/`partiesUpdateId` set never re-creates.

## 9. Out of scope (explicit)

- Creating/updating Contacts records from this app.
- Any relation column between Done Deals and Contacts (structure change — forbidden).
- Plan A UX polish items (separate spec/plan).
- Invoicing automation itself (downstream, Finance-owned).

## 10. Risks / tradeoffs accepted

- Additional parties are not individually queryable columns — they live in the item's
  Updates feed. Accepted "for now" per Adrian; revisit if Finance needs them structured.
- Contact lookup is fill-only; later edits to a Contact don't sync back to a submitted
  deal.
- Live testing of `create_update` + phone-column writes must follow the 1-throwaway-
  listing rule before any real submission.
