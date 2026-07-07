# Parties, Billing, A/R Dates & Doc Requiredness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement spec `docs/superpowers/specs/2026-07-06-parties-billing-ar-docs-design.md` — contact lookup, multiple sellers/buyers (primary-only columns + context update), billing contact, A/R due dates, conditional document requiredness.

**Architecture:** Pure data/compute changes first (columns → types → builders → validators), UI last. Primary party keeps today's column writes byte-for-byte (invoicing depends on them); additional parties post as one `create_update` on the Done Deal inside submit step 2 (resume-safe). Billing derives from primary seller behind a toggle via one shared pure resolver used by UI + submit.

**Tech Stack:** Vite + React + TS, `monday-sdk-js`, Vitest (node env, pure functions only).

## Global Constraints (from spec — verbatim law)

- Values-only writes. No board/column/label creation or edits, ever. `create_update` is allowed.
- `docs/COLUMN-MAP.md` and `src/lib/donedeal/columns.ts` change **together**.
- Status/dropdowns written by label text. Submit stays sequential, stop-on-failure, no rollback, resume-safe (held IDs never double-create).
- Structured Client/TLB columns = PRIMARY party only. Never concatenations.
- `?mock=1` makes zero API calls.
- All new column IDs were verified live 2026-07-06: A/R Due Date `date_mkzwfznd`; DD billing `text_mm4ktvac`/`text_mm4k6zqv`/`text_mm4kb57f`/`phone_mm4k19qa`/`text_mm4kn634`/`text_mm4khfpx`/`text_mm4kbz8x`/`text_mm4kxrb3`; A/R billing `text_mm4khzqw`/`text_mm4k33zm`/`text_mm4kps0s`/`phone_mm4knzdp`/`text_mm4k2hfr`/`text_mm4k8j46`/`text_mm4k882s`/`text_mm4kebs7`; Contacts board `9262635615`.
- Run from repo root: `/Users/adrianmercado/Documents/Monday Apps/Done_Deal_App`.

---

### Task 1: Column constants (columns.ts + COLUMN-MAP.md)

**Files:**
- Modify: `src/lib/donedeal/columns.ts`
- Modify: `docs/COLUMN-MAP.md`

**Interfaces:**
- Produces: `BOARDS.contacts`, `CONTACT`, `DD_BILLING`, `AR_BILLING`, `AR.dueDate` constants consumed by Tasks 3–7. `FILE_SLOTS` trim happens in Task 6 (not here) so the app stays consistent until the Deductions gate exists.

- [ ] **Step 1: Add constants to columns.ts**

In `BOARDS`, add `contacts: 9262635615,`. In `AR`, add `dueDate: 'date_mkzwfznd',`. Append after the `AR` block:

```ts
/** Contacts board (ISG CRM) — read-only lookup source. */
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
```

- [ ] **Step 2: Mirror in COLUMN-MAP.md**

Add to the A/R Schedules table: `| Due Date | date_mkzwfznd | date | {date:"YYYY-MM-DD"} — optional; single payment falls back to Actual Close Date |`. Add two new sections listing the DD billing and A/R billing columns above, and a Contacts board section (board 9262635615, columns above, read-only, name-contains search). Note in each: "verified live 2026-07-06".

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck && npm test` → both clean.

```bash
git add src/lib/donedeal/columns.ts docs/COLUMN-MAP.md
git commit -m "Add verified column ids: contacts lookup, DD/AR billing, AR due date"
```

---

### Task 2: Data model migration (arrays + billing + dueDate), parity preserved

**Files:**
- Modify: `src/lib/donedeal/types.ts`
- Modify: `src/lib/donedeal/storage.ts`
- Modify: `src/lib/donedeal/read.ts` (prefill)
- Modify: `src/lib/donedeal/mock.ts` (mockForm)
- Modify: `src/lib/donedeal/compute.ts` (validateParties + primary helpers)
- Modify: `src/lib/donedeal/submit.ts` (primary refs only — payloads byte-identical)
- Modify: `src/components/steps/DealParties.tsx` (multi-card UI)
- Modify: `src/components/steps/ReviewSubmit.tsx` (primary refs + additional counts)
- Test: `src/lib/donedeal/storage.test.ts` (new), `src/lib/donedeal/submit.test.ts`, `src/lib/donedeal/compute.test.ts` (updated shape)

**Interfaces:**
- Produces: `PartyEntry`, `makeParty(id): PartyEntry`, `BillingContact`, `FormData.dealParties: {sellers: PartyEntry[]; buyers: PartyEntry[]}`, `FormData.billing`, `PaymentRow.dueDate: string`, `normalizeDraft(parsed: unknown): FormData`, `primarySeller(form)`, `primaryBuyer(form)`.
- Consumes: nothing new.

- [ ] **Step 1: Write failing migration test** (`src/lib/donedeal/storage.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { normalizeDraft } from './storage';

describe('normalizeDraft', () => {
  it('migrates legacy {seller, buyer} drafts into arrays and fills new keys', () => {
    const legacy = {
      dealParties: {
        seller: { name: 'Old Seller LLC', company: 'OS Co', email: 's@x.com', phone: '1', entity: 'E' },
        buyer: { name: 'Old Buyer', company: 'OB Co', email: 'b@x.com' },
      },
      commission: { isHouseDeal: 'No', houseDealPrincipal: '', brokers: [], multiplePayments: false,
        paymentSchedule: [{ id: 'payment-1', amount: 500 }] },
    };
    const f = normalizeDraft(legacy);
    expect(f.dealParties.sellers[0].name).toBe('Old Seller LLC');
    expect(f.dealParties.buyers[0].name).toBe('Old Buyer');
    expect(f.dealParties.buyers[0].phone).toBe('');
    expect(f.billing.sameAsSeller).toBe(true);
    expect(f.commission.paymentSchedule[0].dueDate).toBe('');
    expect(f.documents.psa).toEqual([]);
  });

  it('passes new-shape drafts through intact', () => {
    const f1 = normalizeDraft({
      dealParties: { sellers: [{ id: 's1', name: 'New', company: '', email: '', phone: '', entity: '' }],
        buyers: [{ id: 'b1', name: 'NB', company: '', email: '', phone: '', entity: '' }] },
    });
    expect(f1.dealParties.sellers[0].name).toBe('New');
    expect(f1.dealParties.buyers).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/donedeal/storage.test.ts` → FAIL (`normalizeDraft` not exported).

- [ ] **Step 3: Change the model in types.ts**

Replace `PaymentRow` and the `dealParties` block; add `PartyEntry`, `BillingContact`, `makeParty`; extend `INITIAL_FORM_DATA`:

```ts
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

export interface PaymentRow {
  id: string;
  /** Dollar amount (ignored when multiplePayments = false — derived from Scheduled Commission). */
  amount: number;
  /** YYYY-MM-DD. Optional for single payment (falls back to Actual Close Date). */
  dueDate: string;
}
```

In `FormData`: `dealParties: { sellers: PartyEntry[]; buyers: PartyEntry[] };` plus new top-level `billing: BillingContact;`. In `INITIAL_FORM_DATA`:

```ts
dealParties: { sellers: [makeParty('seller-1')], buyers: [makeParty('buyer-1')] },
billing: { sameAsSeller: true, name: '', company: '', address: '', phone: '',
  email1: '', email2: '', email3: '', email4: '' },
```

and `paymentSchedule: [{ id: 'payment-1', amount: 0, dueDate: '' }]`.

- [ ] **Step 4: Add `normalizeDraft` to storage.ts and use it in `loadDraft`**

```ts
import type { FormData } from './types';
import { INITIAL_FORM_DATA, makeParty } from './types';

/**
 * Coerce any saved draft (including the legacy single seller/buyer shape) into
 * the current FormData shape. Unknown keys are dropped; missing keys default.
 */
export function normalizeDraft(parsed: unknown): FormData {
  const base = structuredClone(INITIAL_FORM_DATA);
  const p = (parsed ?? {}) as Record<string, any>;
  const out: FormData = { ...base, ...p };

  const dp = p.dealParties;
  if (dp && Array.isArray(dp.sellers)) {
    out.dealParties = {
      sellers: dp.sellers.map((s: any, i: number) => ({ ...makeParty(s?.id ?? `seller-${i + 1}`), ...s })),
      buyers: (dp.buyers ?? []).map((b: any, i: number) => ({ ...makeParty(b?.id ?? `buyer-${i + 1}`), ...b })),
    };
    if (out.dealParties.buyers.length === 0) out.dealParties.buyers = [makeParty('buyer-1')];
  } else if (dp) {
    out.dealParties = {
      sellers: [{ ...makeParty('seller-1'), ...(dp.seller ?? {}) }],
      buyers: [{ ...makeParty('buyer-1'), ...(dp.buyer ?? {}) }],
    };
  } else {
    out.dealParties = base.dealParties;
  }

  out.billing = { ...base.billing, ...(p.billing ?? {}) };
  out.commission = { ...base.commission, ...(p.commission ?? {}) };
  out.commission.paymentSchedule = (out.commission.paymentSchedule ?? []).map((r: any, i: number) => ({
    id: r?.id ?? `payment-${i + 1}`,
    amount: typeof r?.amount === 'number' ? r.amount : 0,
    dueDate: r?.dueDate ?? '',
  }));
  if (out.commission.paymentSchedule.length === 0)
    out.commission.paymentSchedule = [{ id: 'payment-1', amount: 0, dueDate: '' }];
  return out;
}
```

In `loadDraft`, replace the return with `return value ? normalizeDraft(JSON.parse(value)) : null;`.

- [ ] **Step 5: Primary helpers + validateParties in compute.ts**

```ts
import { makeParty, type PartyEntry } from './types';   // extend existing import

export function primarySeller(form: FormData): PartyEntry {
  return form.dealParties.sellers[0] ?? makeParty('seller-1');
}
export function primaryBuyer(form: FormData): PartyEntry {
  return form.dealParties.buyers[0] ?? makeParty('buyer-1');
}
```

Replace `validateParties`:

```ts
export function validateParties(form: FormData): string[] {
  const errs: string[] = [];
  if (!primarySeller(form).name.trim()) errs.push('Primary Seller name is required.');
  if (!primaryBuyer(form).name.trim()) errs.push('Primary Buyer name is required.');
  const extras = [...form.dealParties.sellers.slice(1), ...form.dealParties.buyers.slice(1)];
  if (extras.some((p) => !p.name.trim()))
    errs.push('Every additional party needs a name — or remove it.');
  return errs;
}
```

(Billing requirements are added to this validator in Task 5.)

- [ ] **Step 6: Re-point read.ts, mock.ts, submit.ts, ReviewSubmit.tsx to primaries**

`read.ts` `prefillFromItem`: replace the five `f.dealParties.seller.*` lines with:

```ts
f.dealParties.sellers = [{
  id: 'seller-1',
  name: disp(item, ISG.ownerNameMirror),
  company: disp(item, ISG.ownerCompanyMirror),
  email: disp(item, ISG.emailMirror),
  phone: disp(item, ISG.officePhoneMirror) || disp(item, ISG.cellPhoneMirror),
  entity: disp(item, ISG.ownerEntity),
}];
```

and the single-payment default line becomes `[{ id: 'payment-1', amount: f.dealDetails.scheduledCommission, dueDate: '' }]`.

`mock.ts` `mockForm`: replace `f.dealParties.seller = {...}` / `f.dealParties.buyer = {...}` with `f.dealParties.sellers = [{ id: 'seller-1', ...old seller fields }]` and `f.dealParties.buyers = [{ id: 'buyer-1', ...old buyer fields, phone: '', entity: '' }]`; payment rows get `dueDate: '2026-06-30'`; add
`f.billing = { sameAsSeller: false, name: 'Jane Roe', company: 'Bedford Holdings LLC', address: '250 Bedford Ave, Brooklyn, NY 11211', phone: '(917) 555-0142', email1: 'ap@bedfordholdings.com', email2: '', email3: '', email4: '' };`

`submit.ts`: import `primarySeller, primaryBuyer` from `./compute`; in `buildListingUpdate` use `primaryBuyer(form).name/.company/.email`; in `buildDoneDeal` set `const seller = primarySeller(form); const buyer = primaryBuyer(form);` and use them for sellerName/sellerCompany/buyerName/buyerCompany/sellerEmail/buyerEmail and the itemName fallback; in `buildArItem` use `primarySeller(form).name` / `primaryBuyer(form).name`.

`ReviewSubmit.tsx` parties card:

```tsx
<SummaryCard title="Deal parties" step={4} onEdit={onEdit}>
  <DataRow label="Primary seller" value={form.dealParties.sellers[0]?.name} />
  <DataRow label="Seller company" value={form.dealParties.sellers[0]?.company} />
  <DataRow label="Primary buyer" value={form.dealParties.buyers[0]?.name} />
  <DataRow label="Buyer company" value={form.dealParties.buyers[0]?.company} />
  {form.dealParties.sellers.length > 1 && (
    <DataRow label="Additional sellers" value={form.dealParties.sellers.length - 1} numeric />
  )}
  {form.dealParties.buyers.length > 1 && (
    <DataRow label="Additional buyers" value={form.dealParties.buyers.length - 1} numeric />
  )}
</SummaryCard>
```

Checklist label 'Seller and buyer named' stays wired to `validateParties`.

- [ ] **Step 7: Rewrite DealParties.tsx — cards + add/remove (no lookup/billing yet)**

```tsx
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Section, Field, TextInput, Button } from '@/components/ui/primitives';
import { makeParty, type PartyEntry } from '@/lib/donedeal/types';
import type { StepProps } from './types';

let seq = 0;
const nextId = (p: string) => `${p}-${Date.now()}-${seq++}`;

type Side = 'sellers' | 'buyers';

function PartyCard({ party, side, index, update, canRemove }: {
  party: PartyEntry; side: Side; index: number;
  update: StepProps['update']; canRemove: boolean;
}) {
  const set = (field: keyof PartyEntry, value: string) =>
    update((d) => { d.dealParties[side][index][field] = value; });
  const remove = () =>
    update((d) => { d.dealParties[side] = d.dealParties[side].filter((p) => p.id !== party.id); });
  const isSeller = side === 'sellers';
  const label = index === 0 ? (isSeller ? 'Primary seller' : 'Primary buyer')
    : `${isSeller ? 'Seller' : 'Buyer'} ${index + 1}`;
  return (
    <div className="rounded-button border border-border p-[12px]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-ink">{label}</span>
        {canRemove && (
          <button type="button" onClick={remove} aria-label={`Remove ${label}`}
            className="text-muted transition-colors hover:text-brand-red">
            <IconTrash size={15} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" required={index === 0}>
          <TextInput value={party.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Company">
          <TextInput value={party.company} onChange={(e) => set('company', e.target.value)} />
        </Field>
        <Field label="Email" className={isSeller ? '' : 'sm:col-span-2'}>
          <TextInput value={party.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        {isSeller && (
          <>
            <Field label="Phone">
              <TextInput value={party.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Entity" className="sm:col-span-2">
              <TextInput value={party.entity} onChange={(e) => set('entity', e.target.value)} />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

/** Step 4 — Deal parties. Primary seller pre-filled from mirrors; more parties addable. */
export function DealParties({ form, update }: StepProps) {
  const addParty = (side: Side) =>
    update((d) => { d.dealParties[side].push(makeParty(nextId(side))); });
  return (
    <div className="space-y-4">
      <Section title="Sellers" description="Primary seller is pre-filled from the linked property record. Editable.">
        <div className="space-y-2.5">
          {form.dealParties.sellers.map((p, i) => (
            <PartyCard key={p.id} party={p} side="sellers" index={i} update={update} canRemove={i > 0} />
          ))}
        </div>
        <Button variant="secondary" onClick={() => addParty('sellers')} className="mt-3 h-7 px-2 text-[12px]">
          <IconPlus size={13} aria-hidden /> Add another seller
        </Button>
      </Section>
      <Section title="Buyers" description="Entered by you.">
        <div className="space-y-2.5">
          {form.dealParties.buyers.map((p, i) => (
            <PartyCard key={p.id} party={p} side="buyers" index={i} update={update} canRemove={i > 0} />
          ))}
        </div>
        <Button variant="secondary" onClick={() => addParty('buyers')} className="mt-3 h-7 px-2 text-[12px]">
          <IconPlus size={13} aria-hidden /> Add another buyer
        </Button>
      </Section>
    </div>
  );
}
```

- [ ] **Step 8: Update existing tests to the new shape**

`submit.test.ts` `fullDeal()`: replace `f.dealParties.seller.name = ...` etc. with

```ts
f.dealParties.sellers = [{ id: 's1', name: 'Seller LLC', company: '', email: 'seller@example.com', phone: '', entity: '' }];
f.dealParties.buyers = [{ id: 'b1', name: 'Buyer LLC', company: '', email: '', phone: '', entity: '' }];
f.commission.paymentSchedule = [{ id: '1', amount: 100000, dueDate: '2026-07-15' }];
```

Any `compute.test.ts` uses of `dealParties.seller`/`buyer`/`paymentSchedule` get the same treatment (arrays + `dueDate: ''`). Assertions on DD/ISG/AR party columns stay untouched — that's the parity proof.

- [ ] **Step 9: Verify + commit**

Run: `npx vitest run && npm run typecheck` → all pass (migration test now green; submit builder tests prove payload parity).

```bash
git add -A src docs
git commit -m "Model: multi-party sellers/buyers, billing, payment due dates + draft migration"
```

---

### Task 3: Additional-parties context update (submit step 2, resume-safe)

**Files:**
- Modify: `src/lib/donedeal/submit.ts`
- Test: `src/lib/donedeal/submit.test.ts`, `src/lib/donedeal/submit-resume.test.ts` (new)

**Interfaces:**
- Produces: `buildPartiesUpdate(form: FormData): string | null` (exported, pure); `SubmitState.partiesUpdateId: string | null`.
- Consumes: `PartyEntry` arrays from Task 2.

- [ ] **Step 1: Failing tests for buildPartiesUpdate** (append to submit.test.ts)

```ts
import { buildPartiesUpdate } from './submit';

describe('buildPartiesUpdate', () => {
  it('returns null when there are no additional parties', () => {
    expect(buildPartiesUpdate(fullDeal())).toBeNull();
  });
  it('formats additional sellers and buyers with numbering from 2', () => {
    const f = fullDeal();
    f.dealParties.sellers.push({ id: 's2', name: '250 BK Partners LLC', company: 'BK Cap', email: 'jane@bk.com', phone: '(917) 555-0102', entity: '250 BK LLC' });
    f.dealParties.buyers.push({ id: 'b2', name: 'Acme Capital', company: '', email: 'bob@acme.com', phone: '', entity: '' });
    const body = buildPartiesUpdate(f)!;
    expect(body).toContain('Additional parties (from Done Deal wizard)');
    expect(body).toContain('Sellers:');
    expect(body).toContain('2) 250 BK Partners LLC — BK Cap · jane@bk.com · (917) 555-0102 · 250 BK LLC');
    expect(body).toContain('Buyers:');
    expect(body).toContain('2) Acme Capital · bob@acme.com');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/donedeal/submit.test.ts` → FAIL (not exported).

- [ ] **Step 3: Implement in submit.ts**

Add `partiesUpdateId: string | null` to `SubmitState` + `INITIAL_SUBMIT_STATE` (`null`). Add:

```ts
/** Plain-text update body for parties beyond the primaries; null when none. */
export function buildPartiesUpdate(form: FormData): string | null {
  const extraSellers = form.dealParties.sellers.slice(1);
  const extraBuyers = form.dealParties.buyers.slice(1);
  if (extraSellers.length === 0 && extraBuyers.length === 0) return null;
  const line = (p: FormData['dealParties']['sellers'][number], n: number) => {
    const head = p.company ? `${p.name} — ${p.company}` : p.name;
    const rest = [p.email, p.phone, p.entity].filter(Boolean).join(' · ');
    return `  ${n}) ${rest ? `${head} · ${rest}` : head}`;
  };
  const lines = ['Additional parties (from Done Deal wizard)'];
  if (extraSellers.length) lines.push('Sellers:', ...extraSellers.map((p, i) => line(p, i + 2)));
  if (extraBuyers.length) lines.push('Buyers:', ...extraBuyers.map((p, i) => line(p, i + 2)));
  return lines.join('\n');
}

async function postUpdate(itemId: string, body: string): Promise<string> {
  const mutation = `
    mutation PostUpdate($item: ID!, $body: String!) {
      create_update(item_id: $item, body: $body) { id }
    }`;
  const data = await api<{ create_update: { id: string } }>(mutation, { item: itemId, body });
  return data.create_update.id;
}
```

Rework `runSubmission` step 2 to be internally resume-safe:

```ts
if (s.completedSteps < 2) {
  onProgress(2, STEP_LABELS[1], 'running');
  if (!s.doneDealId) s.doneDealId = await createDoneDeal(ctx, form, wf, now);
  const partiesBody = buildPartiesUpdate(form);
  if (partiesBody && !s.partiesUpdateId) s.partiesUpdateId = await postUpdate(s.doneDealId, partiesBody);
  s.completedSteps = 2;
  onProgress(2, STEP_LABELS[1], 'done');
}
```

- [ ] **Step 4: Resume-safety test** (`src/lib/donedeal/submit-resume.test.ts`) — mock the api module, fail the update once, retry, assert `create_item` ran exactly once:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: string[] = [];
let failUpdateOnce = true;
vi.mock('../monday/sdk', () => ({
  api: vi.fn(async (query: string) => {
    if (query.includes('create_item')) { calls.push('create_item'); return { create_item: { id: 'dd-1' } }; }
    if (query.includes('create_update')) {
      calls.push('create_update');
      if (failUpdateOnce) { failUpdateOnce = false; throw new Error('boom'); }
      return { create_update: { id: 'u-1' } };
    }
    if (query.includes('create_subitem')) { calls.push('create_subitem'); return { create_subitem: { id: 'sub-1' } }; }
    calls.push('other');
    return { change_multiple_column_values: { id: 'x' } };
  }),
  monday: {},
}));

import { runSubmission, INITIAL_SUBMIT_STATE } from './submit';
import { INITIAL_FORM_DATA, type FormData } from './types';

function dealWithExtraSeller(): FormData {
  const f = structuredClone(INITIAL_FORM_DATA);
  f.dealDetails.address = '500 Broadway';
  f.dealDetails.scheduledCommission = 100000;
  f.dealParties.sellers = [
    { id: 's1', name: 'Seller LLC', company: '', email: '', phone: '', entity: '' },
    { id: 's2', name: 'Extra LLC', company: '', email: '', phone: '', entity: '' },
  ];
  f.dealParties.buyers = [{ id: 'b1', name: 'Buyer LLC', company: '', email: '', phone: '', entity: '' }];
  f.commission.brokers = [{ id: 'br1', profileId: '', name: 'Todd Cooper', participantType: 'Originator', splitPercent: '100' }];
  f.commission.paymentSchedule = [{ id: 'p1', amount: 100000, dueDate: '' }];
  return f;
}

describe('runSubmission resume', () => {
  beforeEach(() => { calls.length = 0; failUpdateOnce = true; });

  it('never re-creates the Done Deal when retrying a failed parties update', async () => {
    const ctx = { itemId: '123', userId: 1, profiles: [] };
    const form = dealWithExtraSeller();
    const r1 = await runSubmission(ctx, form, { ...INITIAL_SUBMIT_STATE }, () => {});
    expect(r1.ok).toBe(false);
    expect(r1.failedStep).toBe(2);
    expect(r1.state.doneDealId).toBe('dd-1');
    const r2 = await runSubmission(ctx, form, r1.state, () => {});
    expect(r2.ok).toBe(true);
    expect(calls.filter((c) => c === 'create_item' ).length).toBeGreaterThanOrEqual(1);
    // Done Deal create must have happened exactly once across both runs:
    const query = calls.join(',');
    expect(query.split('create_update').length - 1).toBe(2); // failed once, succeeded once
  });
});
```

Note: A/R items also use `create_item`; assert Done-Deal-create-once by counting `create_item` calls **before** the first `create_subitem` in `calls` (exactly 1). Adjust the assertion accordingly:

```ts
const firstSub = calls.indexOf('create_subitem');
expect(calls.slice(0, firstSub).filter((c) => c === 'create_item')).toHaveLength(1);
```

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run` → all pass. `npm run typecheck` → clean.

```bash
git add src/lib/donedeal/submit.ts src/lib/donedeal/submit.test.ts src/lib/donedeal/submit-resume.test.ts
git commit -m "Post additional parties as context update on Done Deal (resume-safe step 2)"
```

---

### Task 4: A/R due dates + derived single payment (stale-amount fix)

**Files:**
- Modify: `src/lib/donedeal/compute.ts`, `src/lib/donedeal/submit.ts`, `src/components/steps/CommissionSplits.tsx`
- Test: `src/lib/donedeal/compute.test.ts`, `src/lib/donedeal/submit.test.ts`

**Interfaces:**
- Produces: `effectivePayments(form: FormData): PaymentRow[]` (exported from compute.ts).
- Consumes: `PaymentRow.dueDate` from Task 2.

- [ ] **Step 1: Failing tests**

compute.test.ts:

```ts
import { effectivePayments, paymentTotal, validateCommission } from './compute';

describe('effectivePayments', () => {
  it('derives the single payment from Scheduled Commission (never a stale copy)', () => {
    const f = base(); // existing helper or structuredClone(INITIAL_FORM_DATA)
    f.dealDetails.scheduledCommission = 250000;
    f.commission.multiplePayments = false;
    f.commission.paymentSchedule = [{ id: 'p1', amount: 99, dueDate: '2026-08-01' }];
    expect(effectivePayments(f)).toEqual([{ id: 'p1', amount: 250000, dueDate: '2026-08-01' }]);
    expect(paymentTotal(f)).toBe(250000);
  });
  it('requires a due date on every row only when multiple payments', () => {
    const f = base();
    f.dealDetails.scheduledCommission = 100;
    f.commission.brokers = [{ id: 'b', profileId: '', name: 'X', participantType: 'Originator', splitPercent: '100' }];
    f.commission.multiplePayments = true;
    f.commission.paymentSchedule = [
      { id: 'p1', amount: 50, dueDate: '2026-08-01' },
      { id: 'p2', amount: 50, dueDate: '' },
    ];
    expect(validateCommission(f)).toContain('Every payment needs a due date.');
    f.commission.paymentSchedule[1].dueDate = '2026-09-01';
    expect(validateCommission(f)).not.toContain('Every payment needs a due date.');
  });
});
```

submit.test.ts:

```ts
it('writes Due Date and falls back to Actual Close Date for the single payment', () => {
  const f = fullDeal();
  f.commission.multiplePayments = false;
  f.commission.paymentSchedule = [{ id: 'p1', amount: 0, dueDate: '' }];
  f.dealDetails.actualCloseDate = '2026-07-01';
  const { cols } = buildArItem(f, 0, 'dd-1');
  expect(cols[AR.dueDate]).toEqual({ date: '2026-07-01' });
  expect(cols[AR.scheduledAmount]).toBe(100000); // derived from scheduledCommission
});
```

- [ ] **Step 2: Run both files** → FAIL (`effectivePayments` missing; no dueDate col).

- [ ] **Step 3: Implement**

compute.ts:

```ts
import type { FormData, PaymentRow } from './types';   // extend import

/**
 * The real payment rows. Single-payment mode derives amount from Scheduled
 * Commission so edits on step 3 can never leave a stale copy behind.
 */
export function effectivePayments(form: FormData): PaymentRow[] {
  const c = form.commission;
  if (c.multiplePayments) return c.paymentSchedule;
  const first = c.paymentSchedule[0];
  return [{ id: first?.id ?? 'payment-1', amount: num(form.dealDetails.scheduledCommission), dueDate: first?.dueDate ?? '' }];
}
```

`paymentTotal` reduces over `effectivePayments(form)`. In `validateCommission` add:

```ts
if (c.multiplePayments && c.paymentSchedule.some((p) => !p.dueDate)) {
  errs.push('Every payment needs a due date.');
}
```

submit.ts `buildArItem`: `const rows = effectivePayments(form);` (import it), and after building `cols`:

```ts
const due = row.dueDate || form.dealDetails.actualCloseDate;
if (due) cols[AR.dueDate] = dateVal(due);
```

`createArItems`: loop bound becomes `effectivePayments(form).length`.

CommissionSplits.tsx: render rows from `effectivePayments(form)`; amount input value stays as-is for multiple mode, and for single mode shows the derived amount (still disabled). Add a date input per row after the amount:

```tsx
<Field label={c.multiplePayments ? 'Due date' : 'Due date (optional)'} className="!mb-0">
  <TextInput
    type="date"
    className="num max-w-[170px]"
    value={p.dueDate || (!c.multiplePayments ? form.dealDetails.actualCloseDate : '')}
    onChange={(e) => updatePaymentDate(p.id, e.target.value)}
  />
</Field>
```

with mutators (and `toggleMultiple`/`addPayment` gaining `dueDate: ''`):

```ts
function updatePaymentDate(id: string, dueDate: string) {
  update((d) => {
    const p = d.commission.paymentSchedule.find((x) => x.id === id);
    if (p) p.dueDate = dueDate;
  });
}
```

`toggleMultiple('No')` resets to `[{ id: 'payment-1', amount: 0, dueDate: '' }]` — amount is derived from here on. The rows the map iterates come from `effectivePayments(form)`, but `updatePayment`/`updatePaymentDate` still mutate `paymentSchedule` by id (ids match — `effectivePayments` preserves row 0's id).

- [ ] **Step 4: Run** `npx vitest run && npm run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/donedeal/compute.ts src/lib/donedeal/submit.ts src/components/steps/CommissionSplits.tsx src/lib/donedeal/compute.test.ts src/lib/donedeal/submit.test.ts
git commit -m "A/R due dates + derive single payment from scheduled commission"
```

---

### Task 5: Billing contact (resolver, validation, writes, UI)

**Files:**
- Modify: `src/lib/donedeal/compute.ts`, `src/lib/donedeal/submit.ts`, `src/components/steps/DealParties.tsx`, `src/components/steps/ReviewSubmit.tsx`
- Test: `src/lib/donedeal/compute.test.ts`, `src/lib/donedeal/submit.test.ts`

**Interfaces:**
- Produces: `resolvedBilling(form: FormData): ResolvedBilling` where `ResolvedBilling = { name; company; address; phone; email1; email2; email3; email4 }` (all string).
- Consumes: `primarySeller` (Task 2), `DD_BILLING`/`AR_BILLING` (Task 1).

- [ ] **Step 1: Failing tests**

compute.test.ts:

```ts
import { resolvedBilling, validateParties } from './compute';

describe('billing', () => {
  it('derives name/company/phone/email1 from primary seller while sameAsSeller', () => {
    const f = base();
    f.dealParties.sellers = [{ id: 's1', name: 'Jane Roe', company: 'BH LLC', email: 'j@bh.com', phone: '917', entity: '' }];
    f.billing.sameAsSeller = true;
    f.billing.address = '1 Main St';
    const b = resolvedBilling(f);
    expect(b).toMatchObject({ name: 'Jane Roe', company: 'BH LLC', email1: 'j@bh.com', phone: '917', address: '1 Main St' });
  });
  it('requires name, company, address, phone, email1', () => {
    const f = base();
    f.dealParties.sellers = [{ id: 's1', name: 'S', company: '', email: '', phone: '', entity: '' }];
    f.dealParties.buyers = [{ id: 'b1', name: 'B', company: '', email: '', phone: '', entity: '' }];
    f.billing = { sameAsSeller: false, name: '', company: '', address: '', phone: '', email1: '', email2: '', email3: '', email4: '' };
    const errs = validateParties(f);
    expect(errs).toEqual(expect.arrayContaining([
      'Billing contact name is required.', 'Billing contact company is required.',
      'Billing address is required.', 'Billing phone is required.', 'Billing email 1 is required.',
    ]));
  });
});
```

submit.test.ts:

```ts
import { DD_BILLING, AR_BILLING } from './columns';

it('writes billing columns on the Done Deal and each A/R item', () => {
  const f = fullDeal();
  f.billing = { sameAsSeller: false, name: 'AP Team', company: 'Seller LLC', address: '1 Main St',
    phone: '(212) 555-0000', email1: 'ap@seller.com', email2: 'cfo@seller.com', email3: '', email4: '' };
  const dd = buildDoneDeal(f, computeWaterfall(f), ctx, new Date('2026-07-06')).cols;
  expect(dd[DD_BILLING.name]).toBe('AP Team');
  expect(dd[DD_BILLING.email2]).toBe('cfo@seller.com');
  expect(dd[DD_BILLING.phone]).toEqual({ phone: '2125550000', countryShortName: 'US' });
  expect(dd[DD_BILLING.email3]).toBeUndefined(); // pruned
  const ar = buildArItem(f, 0, 'dd-1').cols;
  expect(ar[AR_BILLING.name]).toBe('AP Team');
  expect(ar[AR_BILLING.email1]).toBe('ap@seller.com');
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

compute.ts:

```ts
export interface ResolvedBilling {
  name: string; company: string; address: string; phone: string;
  email1: string; email2: string; email3: string; email4: string;
}

/** Billing as it will be written — sameAsSeller derives live from the primary seller. */
export function resolvedBilling(form: FormData): ResolvedBilling {
  const b = form.billing;
  if (!b.sameAsSeller)
    return { name: b.name, company: b.company, address: b.address, phone: b.phone,
      email1: b.email1, email2: b.email2, email3: b.email3, email4: b.email4 };
  const s = primarySeller(form);
  return { name: s.name, company: s.company, address: b.address, phone: s.phone,
    email1: s.email, email2: b.email2, email3: b.email3, email4: b.email4 };
}
```

Append to `validateParties`:

```ts
const b = resolvedBilling(form);
if (!b.name.trim()) errs.push('Billing contact name is required.');
if (!b.company.trim()) errs.push('Billing contact company is required.');
if (!b.address.trim()) errs.push('Billing address is required.');
if (!b.phone.trim()) errs.push('Billing phone is required.');
if (!b.email1.trim()) errs.push('Billing email 1 is required.');
```

submit.ts — helper + writes (import `resolvedBilling`, `DD_BILLING`, `AR_BILLING`):

```ts
const phoneVal = (p: string) => ({ phone: p.replace(/[^\d]/g, ''), countryShortName: 'US' });

function billingCols(map: typeof DD_BILLING | typeof AR_BILLING, form: FormData): Record<string, unknown> {
  const b = resolvedBilling(form);
  return {
    [map.name]: b.name,
    [map.company]: b.company,
    [map.address]: b.address,
    [map.phone]: b.phone ? phoneVal(b.phone) : undefined,
    [map.email1]: b.email1,
    [map.email2]: b.email2,
    [map.email3]: b.email3,
    [map.email4]: b.email4,
  };
}
```

In `buildDoneDeal` before `prune`: `Object.assign(cols, billingCols(DD_BILLING, form));`. Same in `buildArItem` with `AR_BILLING`. (`prune` drops empties.)

- [ ] **Step 4: Billing UI in DealParties.tsx**

New section under Buyers (import `YesNoToggle` and `resolvedBilling`):

```tsx
<Section title="Billing contact" description="Who Finance invoices. Written to the Done Deal and every A/R payment.">
  <Field label="Same as primary seller">
    <YesNoToggle
      value={form.billing.sameAsSeller ? 'Yes' : 'No'}
      onChange={(v) => update((d) => { d.billing.sameAsSeller = v === 'Yes'; })}
    />
  </Field>
  {(() => {
    const b = resolvedBilling(form);
    const locked = form.billing.sameAsSeller;
    const set = (field: keyof FormData['billing'], value: string) =>
      update((d) => { (d.billing as unknown as Record<string, string>)[field as string] = value; });
    return (
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Contact name" required>
          <TextInput value={b.name} disabled={locked} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Company" required>
          <TextInput value={b.company} disabled={locked} onChange={(e) => set('company', e.target.value)} />
        </Field>
        <Field label="Billing address" required className="sm:col-span-2">
          <TextInput value={b.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="Phone" required>
          <TextInput value={b.phone} disabled={locked} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Email 1" required>
          <TextInput value={b.email1} disabled={locked} onChange={(e) => set('email1', e.target.value)} />
        </Field>
        <Field label="Email 2"><TextInput value={b.email2} onChange={(e) => set('email2', e.target.value)} /></Field>
        <Field label="Email 3"><TextInput value={b.email3} onChange={(e) => set('email3', e.target.value)} /></Field>
        <Field label="Email 4"><TextInput value={b.email4} onChange={(e) => set('email4', e.target.value)} /></Field>
      </div>
    );
  })()}
</Section>
```

(Address + emails 2–4 always editable — the seller card has no address.) ReviewSubmit parties card gains `<DataRow label="Billing contact" value={resolvedBilling(form).name} />`; checklist label becomes `'Seller, buyer, and billing contact complete'`.

- [ ] **Step 5: Run** `npx vitest run && npm run typecheck` → PASS. Note: mock.ts billing (Task 2) already satisfies required fields for `?mock=1` click-through.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "Billing contact: same-as-seller resolver, required validation, DD + A/R writes, UI"
```

---

### Task 6: Conditional document requiredness

**Files:**
- Modify: `src/lib/donedeal/columns.ts` (FILE_SLOTS), `src/lib/donedeal/compute.ts`, `src/components/steps/DocumentUpload.tsx`, `src/components/steps/Deductions.tsx`, `src/components/steps/ReviewSubmit.tsx`
- Test: `src/lib/donedeal/compute.test.ts`

**Interfaces:**
- Produces: `conditionalDocErrors(form: FormData): string[]` (replaces `documentFlags`, which is deleted).
- Consumes: nothing new.

- [ ] **Step 1: Failing test** (compute.test.ts)

```ts
import { conditionalDocErrors, validateDeductions, allValid } from './compute';

describe('conditional documents', () => {
  it('requires co-broker agreement + W-9 only when co-broker is Yes, via validateDeductions', () => {
    const f = base();
    f.deductions.coBroker = 'Yes';
    f.deductions.coBrokerCompany = 'ACME';
    f.deductions.coBrokerFeePercent = '20';
    f.deductions.coBrokerPaymentMethod = 'paid_at_closing';
    expect(validateDeductions(f)).toEqual(expect.arrayContaining([
      'Co-broker agreement missing.', 'Co-broker W-9 missing.',
    ]));
    f.documents.coBrokerAgreement = [{ name: 'cb.pdf' }];
    f.documents.coBrokerW9 = [{ name: 'w9.pdf' }];
    expect(conditionalDocErrors(f)).toEqual([]);
    expect(validateDeductions(f)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** → FAIL (`conditionalDocErrors` missing).

- [ ] **Step 3: Implement in compute.ts**

```ts
/** Docs that become required when their deduction toggle is on. */
export function conditionalDocErrors(form: FormData): string[] {
  const errs: string[] = [];
  if (form.deductions.coBroker === 'Yes') {
    if (form.documents.coBrokerAgreement.length === 0) errs.push('Co-broker agreement missing.');
    if (form.documents.coBrokerW9.length === 0) errs.push('Co-broker W-9 missing.');
  }
  if (form.deductions.referral === 'Yes') {
    if (form.documents.referralAgreement.length === 0) errs.push('Referral agreement missing.');
    if (form.documents.referralW9.length === 0) errs.push('Referral W-9 missing.');
  }
  return errs;
}
```

`validateDeductions` ends with `errs.push(...conditionalDocErrors(form));`. **Delete `documentFlags`**; `allValid` becomes `STEP_VALIDATORS.every((v) => v(form).length === 0)`.

- [ ] **Step 4: UI**

columns.ts `FILE_SLOTS` → keep only `psa`, `ea`, `commissionAgreement` entries (update COLUMN-MAP.md note: step 1 = unconditional docs; co-broker/referral docs collected on Deductions). DocumentUpload.tsx: drop the `coBrokerAgreement`/`referralAgreement` keys from `slotFiles`/`slotKey`; footnote text → `Co-broker and referral paperwork (agreements + W-9s) is collected on the Deductions step and becomes required when those deductions apply.` Deductions.tsx: add `required` to all four `FileSlot`s (visible ⇒ toggle is Yes ⇒ required). ReviewSubmit.tsx: replace `documentFlags` import/usage with `conditionalDocErrors`; the red box stays, driven by `conditionalDocErrors(form)`; checklist item 2 `ok: conditionalDocErrors(form).length === 0`.

- [ ] **Step 5: Run** `npx vitest run && npm run typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src docs
git commit -m "Docs required exactly when their trigger is on; consolidate slots on Deductions"
```

---

### Task 7: ContactLookup (search fn + component + wiring) & final verification

**Files:**
- Create: `src/lib/donedeal/contacts.ts`, `src/components/ui/ContactLookup.tsx`
- Modify: `src/lib/donedeal/mock.ts` (MOCK_CONTACTS), `src/components/steps/DealParties.tsx` (wire into party name fields + billing name)
- Test: `src/lib/donedeal/contacts.test.ts` (new)

**Interfaces:**
- Produces: `ContactHit {id; name; company; email; phone; type}`, `searchContacts(term): Promise<ContactHit[]>`, `mapContactItems(items): ContactHit[]`, `<ContactLookup value onChange onSelect placeholder ariaLabel />`.
- Consumes: `CONTACT`, `BOARDS.contacts` (Task 1); `isMockMode` (mock.ts).

- [ ] **Step 1: Failing test** (`src/lib/donedeal/contacts.test.ts`)

```ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('../monday/sdk', () => ({ api: vi.fn() }));
import { mapContactItems } from './contacts';

describe('mapContactItems', () => {
  it('maps column values and prefers the relation display_value for company', () => {
    const hits = mapContactItems([{
      id: '77', name: 'Jane Roe',
      column_values: [
        { id: 'contact_email', text: 'jane@bh.com' },
        { id: 'phone_mktsq7p5', text: '' },
        { id: 'contact_phone', text: '(212) 555-0000' },
        { id: 'status', text: 'Owner' },
        { id: 'text_mm3c5j1t', text: 'Fallback Co' },
      ],
      company: [{ display_value: 'Bedford Holdings LLC' }],
    }]);
    expect(hits[0]).toEqual({ id: '77', name: 'Jane Roe', company: 'Bedford Holdings LLC',
      email: 'jane@bh.com', phone: '(212) 555-0000', type: 'Owner' });
  });
});
```

- [ ] **Step 2: Run** → FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/donedeal/contacts.ts`**

```ts
import { api } from '../monday/sdk';
import { BOARDS, CONTACT } from './columns';
import { isMockMode, MOCK_CONTACTS } from './mock';

/** A Contacts-board hit used to fast-fill party fields. Fill-only — no link stored. */
export interface ContactHit {
  id: string; name: string; company: string; email: string; phone: string; type: string;
}

interface RawContactItem {
  id: string; name: string;
  column_values: Array<{ id: string; text: string | null }>;
  company: Array<{ display_value?: string | null }>;
}

export function mapContactItems(items: RawContactItem[]): ContactHit[] {
  return items.map((it) => {
    const t = (id: string) => (it.column_values.find((c) => c.id === id)?.text ?? '').trim();
    return {
      id: it.id,
      name: it.name,
      company: (it.company?.[0]?.display_value ?? '').trim() || t(CONTACT.companyText),
      email: t(CONTACT.email),
      phone: t(CONTACT.cellPhone) || t(CONTACT.officePhone),
      type: t(CONTACT.type),
    };
  });
}

const SEARCH_QUERY = `
  query SearchContacts($board: ID!, $term: CompareValue!, $cols: [String!], $rel: [String!]) {
    boards(ids: [$board]) {
      items_page(limit: 8, query_params: { rules: [{ column_id: "name", compare_value: $term, operator: contains_text }] }) {
        items {
          id
          name
          column_values(ids: $cols) { id text }
          company: column_values(ids: $rel) { ... on BoardRelationValue { display_value } }
        }
      }
    }
  }`;

/**
 * Name-contains search over the ISG Contacts board. <2 chars → []. Errors → []
 * (lookup is a convenience, never a blocker). Mock mode never calls the API.
 */
export async function searchContacts(term: string): Promise<ContactHit[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  if (isMockMode()) {
    const t = q.toLowerCase();
    return MOCK_CONTACTS.filter((c) => c.name.toLowerCase().includes(t)).slice(0, 8);
  }
  try {
    const data = await api<{ boards: Array<{ items_page: { items: RawContactItem[] } }> }>(SEARCH_QUERY, {
      board: BOARDS.contacts,
      term: [q],
      cols: [CONTACT.email, CONTACT.cellPhone, CONTACT.officePhone, CONTACT.type, CONTACT.companyText],
      rel: [CONTACT.companyRelation],
    });
    return mapContactItems(data.boards?.[0]?.items_page?.items ?? []);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[contacts] search failed — free-text fallback', e);
    return [];
  }
}
```

mock.ts appends (type-only import — no runtime cycle):

```ts
import type { ContactHit } from './contacts';

/** Canned lookup results for `?mock=1`. */
export const MOCK_CONTACTS: ContactHit[] = [
  { id: 'c1', name: 'Jane Roe', company: 'Bedford Holdings LLC', email: 'jane@bedfordholdings.com', phone: '(917) 555-0101', type: 'Owner' },
  { id: 'c2', name: 'James Roeper', company: 'Roeper Capital', email: 'james@roepercap.com', phone: '(646) 555-0102', type: 'Investor' },
  { id: 'c3', name: 'Maria Chen', company: '250 BK Partners LLC', email: 'maria@250bk.com', phone: '(718) 555-0103', type: 'Owner' },
  { id: 'c4', name: 'Robert Lee', company: 'Acme Capital', email: 'bob@acmecap.com', phone: '(212) 555-0104', type: 'Investor' },
  { id: 'c5', name: 'Sandra Ortiz', company: 'Ortiz Family Office', email: 'sandra@ortizfo.com', phone: '(917) 555-0105', type: 'Family Office' },
  { id: 'c6', name: 'David Kim', company: 'DK Properties', email: 'dkim@dkprop.com', phone: '(347) 555-0106', type: 'Developer' },
];
```

- [ ] **Step 4: Build `src/components/ui/ContactLookup.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { IconSearch, IconLoader2 } from '@tabler/icons-react';
import { searchContacts, type ContactHit } from '@/lib/donedeal/contacts';
import { Pill } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';

/**
 * Type-ahead over the ISG Contacts board. Fill-only: selecting a hit calls
 * onSelect and the caller copies fields; free text is always valid. Silent
 * until 2+ chars; debounced 300ms; errors degrade to no results (RIPCO §1 —
 * search is a convenience, never a blocker). No position:fixed (iframe rule).
 */
export function ContactLookup({ value, onChange, onSelect, placeholder, ariaLabel }: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (hit: ContactHit) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [hits, setHits] = useState<ContactHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  function query(term: string) {
    if (timer.current) clearTimeout(timer.current);
    if (term.trim().length < 2) {
      setHits([]); setOpen(false); setSearching(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const seq = ++seqRef.current;
      setSearching(true);
      const results = await searchContacts(term);
      if (seq !== seqRef.current) return; // stale response — a newer search superseded it
      setSearching(false);
      setHits(results);
      setOpen(results.length > 0);
      setActive(-1);
    }, 300);
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(hit: ContactHit) {
    setOpen(false); setHits([]);
    onSelect(hit);
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => { onChange(e.target.value); query(e.target.value); }}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(hits[active]); }
            else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-expanded={open}
          role="combobox"
          autoComplete="off"
          className="form-input h-8 w-full pr-8 text-[13px]"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted">
          {searching
            ? <IconLoader2 size={14} className="animate-spin" aria-hidden />
            : <IconSearch size={14} aria-hidden />}
        </span>
      </div>
      {open && (
        <ul role="listbox" className="absolute left-0 right-0 top-[34px] z-20 max-h-56 overflow-auto rounded-button border border-border bg-white py-1 shadow-md">
          {hits.map((h, i) => (
            <li key={h.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(h); }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px]',
                  i === active ? 'bg-bg-subtle' : 'hover:bg-bg-subtle',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{h.name}</span>
                  {h.company && <span className="block truncate text-[11.5px] text-muted">{h.company}</span>}
                </span>
                {h.type && <Pill tone="navy">{h.type}</Pill>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire into DealParties.tsx**

Party card Name field becomes:

```tsx
<Field label="Name" required={index === 0} hint="Type 2+ letters to search Contacts, or enter free text.">
  <ContactLookup
    value={party.name}
    ariaLabel={`${label} name`}
    onChange={(v) => set('name', v)}
    onSelect={(hit) =>
      update((d) => {
        const p = d.dealParties[side][index];
        p.name = hit.name;
        if (hit.company) p.company = hit.company;
        if (hit.email) p.email = hit.email;
        if (hit.phone) p.phone = hit.phone;
      })
    }
  />
</Field>
```

Billing "Contact name" gains the same treatment when NOT locked (`sameAsSeller` off): render `ContactLookup` filling billing name/company/phone/email1; when locked keep the disabled `TextInput`.

- [ ] **Step 6: Run everything + mock click-through**

Run: `npx vitest run && npm run typecheck && npm run build` → all clean.
Manual: dev server on :8311 → `http://localhost:8311/?mock=1` → step 4 shows Sellers/Buyers/Billing; typing "ja" in a name field pops Jane Roe/James Roeper; add second seller; step 6 shows due-date fields; step 7 checklist + submit simulation passes.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "ContactLookup type-ahead over Contacts board; wire into parties + billing"
```

---

## Self-review notes

- **Spec coverage:** §1→Task 7 · §2→Tasks 2+3 · §3→Task 4 · §4→Task 5 · §5→Task 6 · §6→Task 1 (+FILE_SLOTS in 6) · §7→Tasks 2/7 (mock) · §8→every task's tests. No gaps.
- **Type consistency:** `PartyEntry`/`makeParty`/`normalizeDraft`/`primarySeller`/`primaryBuyer`/`effectivePayments`/`resolvedBilling`/`conditionalDocErrors`/`buildPartiesUpdate`/`ContactHit` used identically across tasks.
- **Live-test reminder (post-build):** real `create_update`, phone-column and billing writes must be verified against **1 throwaway listing** via `npm run mapps:tunnel` before any real submission (CLAUDE.md rule).
