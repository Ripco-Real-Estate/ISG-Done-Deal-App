# Wizard v2 Fixes — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Executed inline this session.

**Goal:** Fix multi-seller handling (root cause of the Step 2 crash) and ship four related improvements: house-deal UX, number/currency formatting + field reorder, full context snapshot to both records, and A/R Source Type.

**Architecture:** Pure logic in `lib/donedeal` (TDD via vitest); UI in `components/steps`. No Monday schema changes — values only. Seller data read by traversing Listing→Property→Contacts.

**Tech Stack:** React 18 + TypeScript + Vite + vitest; monday-sdk-js (seamless).

## Global Constraints

- API version pinned `2026-04`. No structural Monday writes (values only).
- No `any` in the data layer. Follow existing file patterns.
- Verify with `npm run typecheck` and `npm test` after each logic task.

---

### Task 1: Harden `phoneVal` (permanent phone-crash guard)

**Files:**
- Modify: `src/lib/donedeal/submit.ts` (the `phoneVal` helper)
- Test: `src/lib/donedeal/submit.test.ts`

**Interfaces:**
- Produces: `phoneVal(p: string): { phone: string; countryShortName: 'US' } | undefined`
  (now returns `undefined` when no valid number is present).

- [ ] Step 1: Test — single clean number → 10 digits; multi-number string → first valid only; garbage → `undefined`.
- [ ] Step 2: Run, expect fail.
- [ ] Step 3: Implement: extract digit runs, pick first that is 10 digits (or 11 w/ leading `1` → drop the 1); else `undefined`.
- [ ] Step 4: `npm test` green.

Callers already do `b.phone ? phoneVal(b.phone) : undefined` and `prune` drops `undefined` — verify a returned `undefined` is pruned (it is, object value `undefined`).

---

### Task 2: A/R Source Type

**Files:**
- Modify: `src/lib/donedeal/columns.ts` (`AR` block) — add `sourceType: 'dropdown_mm15b1ek'`
- Modify: `src/lib/donedeal/submit.ts` (`buildArItem`)
- Test: `src/lib/donedeal/submit.test.ts`

- [ ] Step 1: Test — `buildArItem` output includes `[AR.sourceType]: { labels: ['iSales-Seller Rep'] }` when source type set; absent when empty (pruned).
- [ ] Step 2: Run, fail.
- [ ] Step 3: In `buildArItem`, add `if (form.dealDetails.sourceType) cols[AR.sourceType] = dropdownLabels(form.dealDetails.sourceType)`.
- [ ] Step 4: `npm test` green.

---

### Task 3: Multi-seller read (Listing→Property→Contacts)

**Files:**
- Modify: `src/lib/donedeal/read.ts` — add `readSellerContacts(listingId: string): Promise<PartyEntry[]>` and a pure mapper `mapContactsToParties(contacts): PartyEntry[]`
- Modify: `src/App.tsx` — use it during prefill (no-draft path) with fallback
- Test: `src/lib/donedeal/read.test.ts`

**Interfaces:**
- Consumes: `PartyEntry` (from types), `CONTACT` ids, ISG relation `board_relation_mkrdxwqb`, Property relation `board_relation_mkswenwr`.
- Produces: `readSellerContacts(listingId) => PartyEntry[]` (index 0 = primary; `[]` when none).

Traversal:
1. `items(ids:[listingId]){ column_values(ids:["board_relation_mkrdxwqb"]){ ... on BoardRelationValue { linked_item_ids } } }` → propertyId (first).
2. `items(ids:[propertyId]){ column_values(ids:["board_relation_mkswenwr"]){ ... on BoardRelationValue { linked_item_ids } } }` → contactIds.
3. `items(ids: contactIds){ id name column_values(ids:[CONTACT.companyText, CONTACT.email, CONTACT.officePhone, CONTACT.cellPhone]){ id text } }` → map each to `PartyEntry` { id:`seller-<i+1>`, name, company, email, phone: office||cell, entity:'' }.

- [ ] Step 1: Test `mapContactsToParties` — 2 contacts → 2 parties, each single name/phone; office phone preferred over cell; empty list → `[]`.
- [ ] Step 2: Run, fail.
- [ ] Step 3: Implement mapper + `readSellerContacts` (try/catch → `[]` on any failure).
- [ ] Step 4: `npm test` green.
- [ ] Step 5: Wire into `App.tsx`: in the no-draft branch, `const sellers = await readSellerContacts(id); const base = prefillFromItem(listing); if (sellers.length) base.dealParties.sellers = sellers; setForm(base);` — keep buyers/other prefill; fallback to mirror seller when `sellers.length === 0`.

---

### Task 4: Full context snapshot → both records

**Files:**
- Create: `src/lib/donedeal/snapshot.ts` — `buildContextSnapshot(form, wf): string`
- Modify: `src/lib/donedeal/submit.ts` — `SubmitState` (rename `partiesUpdateId`→`doneDealUpdateId`, add `listingUpdateId`), `runSubmission` step 1/2 best-effort posting; remove `buildPartiesUpdate` usage
- Test: `src/lib/donedeal/snapshot.test.ts`, adjust `submit-resume.test.ts`

**Interfaces:**
- Produces: `buildContextSnapshot(form: FormData, wf: Waterfall): string`

- [ ] Step 1: Test — snapshot includes every seller & buyer name, all splits, all A/R rows, key money fields; deterministic (no Date).
- [ ] Step 2: Run, fail.
- [ ] Step 3: Implement sectioned text builder (Deal / Metrics / Sellers / Buyers / Billing / Deductions / Commission+splits / A/R / Docs / Notes).
- [ ] Step 4: Wire posting: step 1 after `updateListing` → `postUpdate(ctx.itemId, snapshot)` in try/catch, store `listingUpdateId`; step 2 after `createDoneDeal` → `postUpdate(doneDealId, snapshot)` in try/catch, store `doneDealUpdateId`. Guard both with held-id checks. Delete `buildPartiesUpdate`/its call.
- [ ] Step 5: `npm test` green (update resume test for renamed field).

---

### Task 5: House-deal redesign

**Files:**
- Modify: `src/components/steps/CommissionSplits.tsx`

- [ ] Step 1: House Deal section = only the `YesNoToggle` (remove principal `Select` + helper text).
- [ ] Step 2: Principal row logic: `setHouseDeal('Yes')` inserts a locked principal row with empty principal (name/profileId until chosen), `participantType:'Originator'`, `splitPercent:String(HOUSE_DEAL_SPLIT)`, `isHouseDealPrincipal:true`. `'No'` removes it + clears `houseDealPrincipal`.
- [ ] Step 3: In the broker-row render, when `isHouseDealPrincipal`, the Broker field becomes a `<select>` of `HOUSE_DEAL_PRINCIPALS`; onChange sets `houseDealPrincipal`, resolves profileId (match profile by name), updates the row's `name`/`profileId`. Participant type + split stay locked/disabled.
- [ ] Step 4: Manual check via tunnel; `validateCommission` unchanged (still requires principal when house deal).

---

### Task 6: Formatting primitives + Deal Details reorder + Total SF

**Files:**
- Modify: `src/components/ui/primitives.tsx` — add `CurrencyInput`, `NumberInput`
- Modify: `src/components/steps/DealDetails.tsx` — reorder + currency inputs
- Modify: `src/components/steps/DealMetrics.tsx` — Total SF comma input
- Modify: `src/components/steps/CommissionSplits.tsx` — A/R amount currency input

**Interfaces:**
- Produces: `CurrencyInput({ value: number|null, onChange:(n:number|null)=>void, ... })`,
  `NumberInput({ value: number|null, onChange:(n:number|null)=>void, ... })`.

- [ ] Step 1: Implement both inputs: internal `focused` state; when not focused show formatted (`money(value)` / grouped digits), when focused show raw numeric string; onChange strips `$ , %` and parses to number|null.
- [ ] Step 2: DealDetails: reorder to Address(full) · [Transaction Type|Source Type] · [Final Sales Price|Contract Price] · [Base Rate %|Scheduled Commission] · [Actual Close Date|—] · Transaction Summary(full). Use `CurrencyInput` for the 3 money fields.
- [ ] Step 3: DealMetrics: Total SF → `NumberInput`.
- [ ] Step 4: CommissionSplits A/R amount → `CurrencyInput`.
- [ ] Step 5: `npm run typecheck`; manual check via tunnel.

---

### Task 7: Verify + reset test listing

- [ ] Step 1: `npm run typecheck` and `npm test` — all green.
- [ ] Step 2: Reset `12471574658`: Deal Stage → `5. Closing Review`; clear Deal Status + Sent to Finance (one-off Monday write).
- [ ] Step 3: Report; user tests via tunnel on a throwaway 2-contact house deal, verifying all Finance boards.

---

## Addendum tasks (Leads Tracker + broker fallback)

### Task 8: Broker dropdown fallback — DONE (show all when none marked Active)

### Task 9: Leads data layer
- columns.ts: `BOARDS.leadsTracker`, `REL.listingToLeads`, `LEAD` block, `LABELS.leadWinner: 'xx. Buyer'`
- types.ts: `WinningLead`, `dealParties.winningLead: WinningLead | null`
- storage.ts normalizeDraft carries `winningLead`
- read.ts: `mapLeadItems` (pure) + `readListingLeads(listingId)` (errors → [])
- Test: mapLeadItems — mirror preferred, Ai fallback, offers sorted first

### Task 10: Submit + snapshot
- submit.ts: `SubmitState.leadClosed`; `closeWinningLeadSafe` (non-fatal) called in step 2
- snapshot.ts: Winning Lead line
- Tests: resume test asserts leadClosed on success; snapshot test asserts the line

### Task 11: UI
- steps/types.ts: `leads: LeadOption[]` on StepProps
- App.tsx: leads state, `void readListingLeads(id).then(setLeads)` on wizard entry, pass through
- DealParties.tsx: Winning buyer Select in Buyers section (fills primary buyer)

### Task 12: COLUMN-MAP.md append (REL, AR.sourceType, LEAD) + single-worker verify
