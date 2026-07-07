# ISG Done Deal Commission Wizard — Design Spec (Rebuild)

**Date:** 2026-07-06
**Status:** Approved for prototype
**Source spec:** `../../../ISG Done Deal Commission Wizard — Full Rebuild Specification.md`
**Authoritative schema:** `../../COLUMN-MAP.md` (verified live 2026-07-06)

---

## 1. What this is

A monday.com **Item View** installed on the **ISG Listings** board (9262635626). When a
listing reaches Deal Stage **"5. Closing Review"**, a broker runs a 7-step wizard that
collects deal docs, metrics, parties, deductions, and commission splits, then writes the
finalized record into three Finance-workspace boards.

It is a **real coded monday app** — Vite + React 18 + TypeScript + Tailwind + `monday-sdk-js`,
deployed to monday-code via the `mapps` CLI. It is **not** a Vibe app. Every Vibe-specific
abstraction in the source spec (`useItem()`, `BoardSDK`, `@api/monday-storage`) is replaced
by direct SDK calls, which is what eliminates the "Known Gotchas" (context-bound SDK,
`monday.api` undefined on first render, double-stringification).

## 2. Two hard constraints (from Adrian, 2026-07-06)

1. **Live schema wins.** Where the source spec's column IDs conflict with the live boards,
   the live board is the source of truth. See `COLUMN-MAP.md` for the ~12 corrections.
2. **Never mutate board structure.** The app reads item values and writes item *values*
   only. It never creates/edits/deletes columns, boards, groups, or labels. Every column
   and label it uses already exists on the live boards. No `create_labels_if_missing`, no
   `create_column`, nothing structural — ever.

## 3. Architecture

```
ISG Listings item (installed board)
   │  read: GraphQL query by column IDs (replaces useItem)
   │  write: change_multiple_column_values + add_file_to_column (replaces BoardSDK)
   ▼
WIZARD STATE  formData { documents, metrics, dealDetails, dealParties, deductions, commission }
   │          profiles[] (Broker Profiles board, read-only, non-blocking)
   │          draft autosave → monday.storage (debounced)
   ▼  submit (5 sequential writes, stop-on-failure, no rollback)
   ├─ 1. UPDATE ISG Listings         (same board; change_multiple_column_values)
   ├─ 2. CREATE Done Deals item      (18401124547)
   ├─ 3. CREATE participant subitems (18401124549)
   ├─ 4. CREATE A/R schedule items   (18401124599)
   └─ 5. LINK A/R items → Done Deal  + clear draft
```

### Layering

| File | Responsibility |
|---|---|
| `lib/monday/sdk.ts` | `monday` instance (API `2026-04`) + `api()` wrapper with error surfacing |
| `lib/donedeal/columns.ts` | **Verified column-ID + label constants.** Single source of truth. |
| `lib/donedeal/types.ts` | `FormData`, `BrokerEntry`, `PaymentRow`, `Profile` types + `INITIAL_FORM_DATA` |
| `lib/donedeal/compute.ts` | **Pure** commission waterfall + split/payment math + per-step validation. Unit-tested. |
| `lib/donedeal/read.ts` | Read the ISG item; read Active profiles (non-blocking). Column-value coercion. |
| `lib/donedeal/submit.ts` | The 5-step write sequence. Builds column-value payloads, double-stringifies for GraphQL. |
| `lib/donedeal/storage.ts` | Draft save/load/clear via `monday.storage`. |
| `App.tsx` | Context + gatekeeper + wizard shell + step routing + submit orchestration + progress. |
| `components/steps/*` | One component per step (Documents…ReviewSubmit). |
| `components/ui/*` | Field, Section, Pill, StepNav, Waterfall, FileSlot, Money — shared primitives. |

## 4. Design principles applied

- **`compute.ts` is pure and framework-free** — all money math and validation live there so
  they can be unit-tested without a browser or the SDK. Components render its output.
- **`columns.ts` is the only place raw column IDs appear.** If a board changes, one file changes.
- **Writes go by label text, not numeric ID**, for dropdowns/statuses. Live IDs are quirky
  (Transaction Type ids 2–5; Co-Broker Yes=1/No=2 but Referral No=1/Yes=2). Labels are stable
  and already exist, so `{"labels":[...]}` / `{"label":"..."}` avoids the whole class of bug.
- **Profiles are optional enhancement.** The UI never blocks on profile loading; manual broker
  name entry is the fallback. Only `item` loading blocks the first paint.

## 5. Gatekeeper

- `deal_stage !== "5. Closing Review"` → gate screen (message + current-stage badge + a
  "Move to Closing Review" button that writes the stage back — value-only write, allowed).
- `deal_stage === "xx. Done Deal"` → post-submit screen (already submitted; link to record;
  wizard hidden).
- Loading screen shows **only** when the item has not loaded yet — never on profile load,
  never during file uploads (`isUploadingFile` guard).

## 6. Wizard steps

1. **Documents** — upload PSA (req), Exclusive Agreement (req), Co-Broker / Referral /
   Commission agreements (optional) to ISG Listings file columns via `add_file_to_column`.
2. **Deal Metrics** — property type, SF (editable, pre-filled from mirror), PPSF (calc),
   cap rate, resi/comm/total units, development / multi-property flags.
3. **Deal Details** — address (editable), transaction type, source type, prices, base rate,
   close date, transaction summary.
4. **Deal Parties** — seller (pre-filled from mirrors, editable), buyer (user-entered).
5. **Deductions** — co-broker + referral modules, fee % → $ calc, payment method, W-9 uploads;
   live financial waterfall.
6. **Commission** — house-deal toggle (Todd Cooper / Mark Kaplan / Peter Ripka @ 16.66%,
   non-removable), broker split table (native `<select>` over Active profiles), A/R payment
   schedule (sum must equal Scheduled Commission).
7. **Review & Submit** — collapsible per-section summary with Edit links, document flags,
   deal notes, validation checklist, locked submit button, 5-step progress with partial-
   success handling and retry-from-failed-step.

## 7. Commission math (single source: `compute.ts`)

```
Full Commission = Scheduled Commission ($)
Co-Broker Fee $ = Full Commission × coBrokerFee%      (if Co-Broker = Yes)
Net to RIPCO    = Full Commission − Co-Broker Fee $
Referral Fee $  = Net to RIPCO × referralFee%          (if Referral = Yes)
Gross Commission = Net to RIPCO − Referral Fee $ − Concessions   (split among brokers)

House Deal = Yes → one principal locked at 16.66% (Split Type "House Deal"), brokers fill 83.34%.
House Deal = No  → brokers must sum to 100%.
A/R payment rows must sum to Scheduled Commission.
```

## 8. Error handling

Sequential, stop-on-failure, **no rollback**. Each failure yields a specific message plus any
IDs already created, and a Retry that resumes from the failed step (Done Deal ID / A/R IDs are
held in state across retries so we never double-create). Per source spec §10.2.

## 9. Testing & rollout

- `compute.test.ts` covers waterfall, house-deal allocation, split totals, A/R totals, and
  per-step validation gates.
- `submit.ts` payload builders are unit-testable (pure column-value assembly) — asserted
  against `COLUMN-MAP.md` IDs.
- **First real submission is run against a single throwaway ISG listing** before the app is
  trusted (Adrian's standing rule: test with 1 item first).

## 10. Deploy prerequisites (Adrian, manual, in monday Developer Center)

The app must be registered before `mapps code:push` will work. See `QUESTIONS.md` Q-DEPLOY.
