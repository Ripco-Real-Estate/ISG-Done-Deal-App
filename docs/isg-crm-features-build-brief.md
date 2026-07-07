# ISG CRM — Features & Claude Code Build Brief

**Hand-off brief for building a functional prototype of the ISG CRM application (Lev-style, Claude-built, Monday server-side) with an embedded Claude chat/agent.**

Version 1.0 · June 2026 · Companion to `isg-crm-spec.md` (vision + board schema) and the product microsite (`index.html`, `screens.html`).

> Read order for Claude Code: (1) this brief, (2) `isg-crm-spec.md` §6 for the exact board/column IDs each feature reads/writes, (3) `screens.html` for visual reference. Build the prototype against **mock data** shaped like the real boards, behind a `DataProvider` interface that can later be swapped to the live Monday API.

---

## 0. What we're building

A web app that replaces the native Monday CRM surface for RIPCO's Investment Sales Group with purpose-built screens, plus a global **Claude chat/agent** panel that can read deal context and prepare gated actions. The prototype is **front-end + a thin server** with **seeded mock data**; the Monday API and the document/AI agents are stubbed behind typed interfaces so they can be wired to production later.

**Definition of done (prototype):** a broker can log in (mock), browse the Pipeline, open a listing, see its leads and offers, manage contacts/companies/lists, run the canvassing map, and use the Claude chat to (a) answer questions grounded in the mock data with citations and (b) propose a write action (e.g., "add a lead", "draft a status report") that the user approves before it's applied to local state.

---

## 1. Reference: how Lev's interface works (study notes)

Build to match these patterns (rebranded RIPCO navy/gold):

- **Left sidebar nav**, persistent. Top: workspace switcher (account name + email). Groups: **Deals** (Pipeline, All listings, Pitches), **Network** (Companies, People), **Market** (Comps), **Files**. Active item highlighted.
- **List/table views** with a **view bar**: `View` selector, inline **filter chips** ("Company type is Debt fund", "Region is Northeast", "Deals is Active"), `Search`, `New …` button, and a count ("128 total · 14 match filters"). Columns are configurable; rows show avatar, name, tags, latest note.
- **Record detail** = left context nav + main panel + **right metadata rail**. Tabs across the top (e.g. Overview / Index / Outreach / Resources / Vaults; or Activity / Emails / Deals / Files). Right rail shows key fields (status, owner, dates, address, asset type) and a related list ("Deals together"). A **"Log note" / "Compose"** action row. Inline **agent buttons** ("Relationship summary", "Pipeline status report").
- **Pipeline** = kanban columns by stage with per-card name, amount, sponsor/owner, asset-type + city tags, and a count per column; plus a "Deals needing attention" table view with priority + next action + stalled indicators.
- **Agent / chat**: launched as a **right-side panel** over any screen. Empty state = greeting "How can I help you today?" + 4 quick-prompt chips (Deals & pipeline updates, Learn, Generate reports & docs, Market data) + composer with **`@` mention** to include deals, files, or teammates. During a run: **visible tool calls** ("Working… 1. Read the upload, 2. Classified 3 documents, 3. Extracted facts with citations"), a **"Worked ✓"** result, **source citations** that link back to records/files, and **approve-before-execute** for any outbound/write action. Every run keeps an **audit trail** (sources, tool calls, outcome).

---

## 2. Recommended stack

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS.** shadcn/ui (Radix) for primitives (dialog, dropdown, popover, tabs, table, toast, command).
- **TanStack Table** for list views, **dnd-kit** for the Pipeline kanban, **@tanstack/react-query** for data fetching against the local API routes.
- **Chat/agent:** `@anthropic-ai/sdk` on a Next.js **route handler** (`/api/chat`) using **streaming** (`messages.stream`) and **tool use**. Key in `ANTHROPIC_API_KEY` (server-only). Model: `claude-opus-4-8` (or `claude-sonnet-4-6` for speed). Stream via SSE/`ReadableStream` to a `useChat`-style hook on the client.
- **Maps (Canvassing):** MapLibre GL JS with a free basemap for the prototype; structure the layer so an **Esri/ArcGIS** feature layer can replace it (the production app embeds the existing Monday ESRI map).
- **Docs:** generate `.docx` status reports with the `docx` npm package (or stub to a print-styled HTML route for the prototype).
- **State for approvals/mock writes:** a Zustand store layered over the mock provider so agent "writes" mutate local state and show in the UI without a backend.

### Project structure (suggested)
```
/app
  /(app)/layout.tsx            // sidebar + topbar + agent panel slot
  /(app)/pipeline/page.tsx
  /(app)/listings/[id]/page.tsx
  /(app)/pitches/page.tsx
  /(app)/contacts/page.tsx  /companies/page.tsx  /lists/page.tsx
  /(app)/leads/page.tsx
  /(app)/properties/page.tsx  /canvassing/page.tsx
  /(app)/agreements/page.tsx
  /api/chat/route.ts           // Claude streaming + tool dispatch
  /api/tools/route.ts          // executes tool calls against DataProvider
/lib
  /data/provider.ts            // DataProvider interface
  /data/mock-provider.ts       // reads /lib/data/seed/*.json
  /data/monday-provider.ts     // STUB: maps to spec §6 column IDs
  /data/seed/*.json            // mock data shaped per board
  /agents/tools.ts             // tool (function) definitions + zod schemas
  /agents/system-prompts.ts
/components
  /chrome (Sidebar, Topbar, AgentPanel, CommandK)
  /views (DataTable, FilterBar, Kanban, RecordDetail, RightRail, ActivityFeed)
  /agent (ChatThread, Message, ToolCallCard, CitationChip, ApprovalCard)
```

### Design tokens
Reuse the microsite's navy/gold system (`styles.css`): `--navy-900 #070f1d`, `--navy-800 #0c1a2e`, `--gold #c9a24b`, status pill colors map to Monday label hexes (green `#00c875`, orange `#fdab3d`, red `#df2f4a`, blue `#579bfc`, purple `#a25ddc`, navy `#225091`). Fonts: Fraunces (display) + Hanken Grotesk (UI), or swap to a clean system pairing for the app shell.

---

## 3. Data layer & mock plan

Define one interface; ship a mock implementation; stub the Monday one.

```ts
// lib/data/provider.ts
export interface DataProvider {
  listListings(filter?: ListingFilter): Promise<Listing[]>;
  getListing(id: string): Promise<ListingDetail>;
  updateListingStage(id: string, stage: ListingStage): Promise<Listing>;
  listLeads(listingId: string): Promise<Lead[]>;
  createLead(input: NewLead): Promise<Lead>;          // listing-scoped (required)
  updateLead(id: string, patch: Partial<Lead>): Promise<Lead>;
  listPitches(filter?: PitchFilter): Promise<Pitch[]>;
  promotePitchToListing(pitchId: string): Promise<Listing>;
  listContacts(filter?: ContactFilter): Promise<Contact[]>;
  getContact(id: string): Promise<ContactDetail>;
  listCompanies(filter?: CompanyFilter): Promise<Company[]>;
  listLists(): Promise<MyList[]>;
  listProperties(filter?: PropertyFilter): Promise<Property[]>;
  listAgreements(): Promise<ExclusiveAgreement[]>;
  logActivity(entity: EntityRef, note: string): Promise<Activity>; // → create_update equiv
}
```

- Each TypeScript type mirrors a board in `isg-crm-spec.md §6`. Keep the **column id** as a comment on each field so `MondayProvider` can map 1:1 later (e.g. `stage // deal_stage`, `offerPrice // numeric_mkrenrvk`).
- **Seed data:** ~25 listings across all stages, ~60 pitches, ~120 leads (scoped to listings), ~300 contacts (typed: Owner/Investor/Attorney/etc., some with Investor Criteria), ~80 companies, ~10 lists, ~200 properties (NYC + FL, with lat/long for the map), ~15 exclusive agreements (with AI-extracted fields populated). Use the names already in the microsite mocks (176 Gold Street, Harbor Point, Golub, Redwood, Silverpeak…) for continuity.
- **Scoping:** seed a current user; person columns (Lead/Team/Visibility) drive what's visible. Implement the rule from the spec: scoped queries only; no full-board fallback.

---

## 4. Feature catalog

Format: **ID — Feature** · _user story_ · acceptance criteria · **data** (board · key columns from spec §6).
Priority: **P0** = prototype core, **P1** = strong-to-have, **P2** = stretch.

### 4.1 App shell & cross-cutting

- **SHELL-1 (P0) Sidebar + workspace nav.** _As a broker, I navigate between Pipeline, Network, Properties, Canvassing, Agreements._ — AC: persistent sidebar matching Lev grouping; active route highlighted; workspace switcher shows user + "10. ISG CRM". 
- **SHELL-2 (P0) Global search / Command-K.** _Jump to any listing, contact, company, property._ — AC: `⌘K` opens fuzzy search across seeded entities; Enter routes to the record.
- **SHELL-3 (P0) Filter bar + saved views.** _Filter any list with chips like Lev._ — AC: add/remove chips (status, owner, type, region); count updates "(N total · M match)"; column show/hide.
- **SHELL-4 (P1) Activity feed / audit.** _Every change is logged._ — AC: writes call `logActivity`; record detail shows a reverse-chron feed; mirrors the `create_update` audit concept.
- **SHELL-5 (P0) Scoped visibility.** AC: toggling "My items / All" respects person columns; default = my items.

### 4.2 Pipeline (ISG Listings · `9262635626`)

- **PIPE-1 (P0) Kanban by stage.** _See every live listing by stage._ — AC: columns = Deal Stage labels (New, Preparing Materials, Listed, Contracts Out, In Contract (DD), In Contract (Hard), Closing Review, Done Deal); cards show name, listing price, owner, property type, office; per-column count. **data:** `deal_stage`, `numeric_mkrdb9pe`, `multiple_person_mkq8v3qn`, `color_mkqys43g`, `color_mkx4mrgw`.
- **PIPE-2 (P0) Drag to change stage.** — AC: dnd-kit move updates `deal_stage` via `updateListingStage`; activity logged; Close Probability (`deal_close_probability`) recomputed by stage.
- **PIPE-3 (P0) "Needs attention" table.** _Surface stalled/at-risk listings._ — AC: table view with priority, stage, next action, days-in-stage; sort "urgent first"; flag missing rent roll / EA Upload Required / closing soon. **data:** `color_mkq1pf8r` (EA Status), `deal_expected_close_date`.
- **PIPE-4 (P1) New listing.** — AC: form creates a listing (status New), optional link to Property Record (`board_relation_mkrdxwqb`).

### 4.3 Listing / deal detail

- **DEAL-1 (P0) Overview + right rail.** _One screen for a listing._ — AC: header (name, stage pill, status); right rail = price set (Listing/Contract/Final), Owner Entity, address & property type (mirrors), Lead/Team, dates, EA Status, commission (Base Rate %, Scheduled Commission, Net to RIPCO). **data:** listing columns per spec §6.5.
- **DEAL-2 (P0) Tabs: Overview / Leads / Offers / Activity / Files / Report.** — AC: tabbed nav like Lev; deep-linkable.
- **DEAL-3 (P0) Leads tab.** embeds Leads board scoped to this listing (see LEADS-*).
- **DEAL-4 (P1) Files tab.** lists deal docs (EA File, PSA, OM, rent roll) from seed; upload stub.
- **DEAL-5 (P1) EA linkage.** shows linked Exclusive Agreement with extracted terms; "EA Status" gates a "Mark Listed/Done Deal" action. **data:** `board_relation_mm16ge45`.

### 4.4 Pitch Tracker (`9262635627`)

- **PITCH-1 (P0) Pitch board by stage.** — AC: groups On Radar / BOV / Pitching Owner; cards show property, owner contact (mirrors), estimated value, est. commission. **data:** `lead_status`, `numeric_mkqyhx4b`, `numeric_mkqyvhjh`, mirrors.
- **PITCH-2 (P0) Promote to Listing.** _Won pitch becomes a listing._ — AC: `promotePitchToListing` creates a Listing (stage New), carries Property Record + owner; pitch marked "Listing Won". 
- **PITCH-3 (P1) Request BOV.** — AC: sets `color_mm1hwsbw` Requested, assigns BOV Point Person, captures instructions; appears in a BOV queue.
- **PITCH-4 (P1) Follow-ups.** — AC: follow-up note/date/priority; "due today" surfaces on home.

### 4.5 Leads Tracker (`9263596898`)

- **LEADS-1 (P0) Listing-scoped lead board.** _Buyers categorized by status._ — AC: grouped by Status funnel (Outreach Made → Interested → Touring → Expecting/Submitted/Accepted Offer → Contract); every lead requires an ISG Listing link. **data:** `status`, `board_relation_mkre94ze`, `board_relation_mkre9mpp`.
- **LEADS-2 (P0) Add lead (single).** — AC: form (Lev "Add Lead"): name, listing (required), associated contact, interest level, status; writes via `createLead`.
- **LEADS-3 (P1) Bulk import.** — AC: paste/upload CSV → preview → validate listing link + de-dupe (scoped to listing) → commit; show rows read / connected / skipped.
- **LEADS-4 (P0) Offer fields.** — AC: capture Offer Price, Initial Deposit, Closing Period, Contingencies, DD Period, Offer Docs; feed LOI Comparison. **data:** `numeric_mkrenrvk`, `text_mm1spqmg`, `text_mm1sc37v`, `text_mm1syvx7`, `text_mm1s770a`, `file_mkrew93c`.
- **LEADS-5 (P1) Promote to contact.** — AC: "Add to Contacts?" Yes creates a ContactsISG record linked back.

### 4.6 Contacts (`9262635615`) & Companies (`9526814002`)

- **CRM-1 (P0) Contacts table + filters.** — AC: Lev-style table (name, type, company, phone/email, last contact, latest note); filter by Type, Investor Criteria (Markets, Property Type, deal-size range). **data:** `status` (Type), `board_relation_mkskzf2a`, IC: columns.
- **CRM-2 (P0) Contact detail.** — AC: tabs Activity / Emails / Deals / Files; right rail (email, phone, owner, company, "Deals together"); Log note / Compose actions. 
- **CRM-3 (P1) Compose with context (Lev "next email, already written").** — AC: "Compose" opens a draft pre-filled by the Claude agent from relationship + deal context; user edits, then Send (stub) logs activity.
- **CRM-4 (P0) Companies table + detail.** — AC: company table (type, contacts, deals); parent-company hierarchy; detail lists contacts + deals. **data:** `board_relation_mksk3064`, `board_relation_mm0vf5f5`.
- **CRM-5 (P1) Investor matching.** _Match buyers to a listing by criteria._ — AC: from a listing, "find matching investors" filters Contacts by IC: Markets/Property Type/deal-size vs the listing; ranked list; one-click add to Leads.

### 4.7 My Lists (`9871281018`)

- **LIST-1 (P1) Lists index + builder.** — AC: list types (Contact / Property / Deal Outreach); add contacts/properties to a list; #-of-contacts + List Health; 750 soft cap warning. **data:** `color_mkyv2w79`, `board_relation_mkyrbn4c`.
- **LIST-2 (P2) Push list to outreach.** — AC: "Use in campaign / e-blast" hands the list to Mass Email/Campaigns (stub).

### 4.8 Properties (`9262635619`) & Canvassing

- **PROP-1 (P0) Properties table.** — AC: filter by property type, borough/submarket, owner; detail shows physical/zoning/tax + linked deals/pitches. **data:** spec §6.7.
- **CANV-1 (P0) Canvassing map.** _Prospect on a map._ — AC: MapLibre map plotting seeded properties by lat/long (`text_mkrdef32`); left target list with filters (maturing / new owner / off-market); pin click → popup (type, owner, last sale, zoning) with **"Create pitch"** → writes a Pitch Tracker item. Structure layer for ESRI swap.
- **CANV-2 (P1) Draw/define a canvass area.** — AC: select an area or submarket → filter properties → save as a Property List.

### 4.9 Exclusive Agreements (`18405710371`)

- **EA-1 (P0) Agreements table.** — AC: EA Status, Agreement Type, Deal Type, linked listing, base/CB rate, dates. **data:** spec §6.8.
- **EA-2 (P0) EA detail with AI-extracted fields.** _Review what the agent pulled from the PDF._ — AC: show `AI:` fields (Start/Exp Date, Term, Base/CB rate, CB split, Tail, Option commission) next to confirmed fields; "Accept AI value" copies into the structured field; MP approval flips EA Status → Approved.
- **EA-3 (P1) Submit for approval.** — AC: assign Managing Partner Approver; status Draft Submitted; approval logs date + notes.

### 4.10 Status Reports

- **REPT-1 (P0) Generate listing report.** _Owner-ready report from live data._ — AC: pick a listing → assemble metrics from Pipeline + Leads (leads, tours, offers, top offer, marketing activity) → render branded ISG navy/gold report (HTML print + `.docx`). Matches `status-report.html` mock. 
- **REPT-2 (P1) Recent + schedule.** — AC: list of generated reports; set weekly/biweekly cadence per listing (uses scheduled-task concept; stub the runner).

---

## 5. Chat / Agent component (Claude SDK)

The differentiator. A global right-side **Agent panel** available on every screen, plus contextual launch buttons ("Relationship summary", "Pipeline status report", "Compare offers").

### 5.1 UX (match Lev)
- **Empty state:** greeting + 4 quick prompts (ISG-flavored): *Pipeline & deal updates · Find matching investors · Generate reports & docs · Market & comps*. Composer with `@`-mention to inject a deal, contact, property, or file as context.
- **Context awareness:** the panel knows the **current record** (route param) and passes it as context automatically (like Lev's "deal-aware reasoning"). `@`-mentions add more.
- **Run rendering:** stream tokens; render **tool-call cards** ("Reading 176 Gold Street → leads", "Comparing 3 offers") as they happen; show a **"Worked ✓"** summary; attach **citation chips** that deep-link to the records/fields used.
- **Approve-before-execute:** any tool that writes returns a **proposed action card** (diff/preview) with **Approve / Edit / Discard**. Nothing mutates state until approved. Approved actions call the write tool and log activity.
- **Run log:** each message keeps sources + tool calls + outcome (audit).

### 5.2 Server: `/api/chat` (streaming + tools)
- Use `anthropic.messages.stream({ model, system, messages, tools })`.
- Loop on `tool_use`: dispatch to handlers in `/api/tools` that call the `DataProvider`; return `tool_result`; continue until `end_turn`. Stream text + tool events to the client over SSE.
- **System prompt** establishes: you are the ISG CRM assistant; you operate over the user's scoped Monday data (mock in prototype); cite sources; never execute a write without an approved action; keep answers grounded — if data isn't found in tools, say so.

### 5.3 Tool definitions (read = auto; write = gated)
Read tools (auto-run): `search_records`, `get_listing`, `list_leads`, `get_contact`, `find_matching_investors`, `compare_offers`, `get_market_comps`, `read_document`(stub returns seeded extraction).
Write tools (require approval): `create_lead`, `update_lead_status`, `move_listing_stage`, `create_pitch`, `log_activity`, `draft_email`, `generate_status_report`, `request_bov`.

```ts
// lib/agents/tools.ts (shape)
export const tools = [
  { name: "get_listing", description: "Fetch a listing with leads, offers, owner, dates.",
    input_schema: { type:"object", properties:{ listingId:{type:"string"} }, required:["listingId"] } },
  { name: "find_matching_investors", description:"Rank contacts whose Investor Criteria match a listing.",
    input_schema:{ type:"object", properties:{ listingId:{type:"string"}, limit:{type:"number"} }, required:["listingId"] } },
  { name: "compare_offers", description:"Normalize offers on a listing into a comparison + recommendation.",
    input_schema:{ type:"object", properties:{ listingId:{type:"string"} }, required:["listingId"] } },
  { name: "create_lead", description:"Create a listing-scoped lead. REQUIRES user approval.",
    input_schema:{ type:"object", properties:{ listingId:{type:"string"}, contactName:{type:"string"},
      company:{type:"string"}, status:{type:"string"}, interestLevel:{type:"string"} }, required:["listingId","contactName"] } },
  { name: "generate_status_report", description:"Assemble an owner status report for a listing. REQUIRES approval.",
    input_schema:{ type:"object", properties:{ listingId:{type:"string"} }, required:["listingId"] } }
  // …move_listing_stage, create_pitch, draft_email, request_bov, log_activity, search_records, get_contact, list_leads, get_market_comps, read_document
];
```

### 5.4 Agent presets (map to the microsite "Agents")
Each is a quick prompt + system preamble that orchestrates tools; for the prototype, ground them on seeded data:
- **OM Extractor** → `read_document` returns seeded extracted fields with page citations; user accepts into the Property/Listing.
- **LOI Comparison** → `compare_offers` builds the normalized table + recommendation + risk flags (matches `loi-comparison.html`).
- **EA Extractor** → `read_document` on an EA returns the `AI:` field set for review (matches EA-2).
- **Origination / Investor matching** → `find_matching_investors`.
- **Sales Comp / Market** → `get_market_comps` (seeded comps).
- **BOV Generator / Status Report / Underwriting** → produce a draft artifact via the corresponding write tool, gated.

---

## 6. Build phases (milestones for Claude Code)

1. **M1 — Shell + data layer.** Next.js app, sidebar/topbar, `DataProvider` + `MockProvider` + seed JSON, design tokens. Pipeline kanban (read) + listing detail (read). _Demo: browse the pipeline and open a deal._
2. **M2 — CRM + leads + write actions.** Contacts/Companies/Lists tables + detail, Leads board (add/import), drag-to-stage, activity log. _Demo: add a lead, move a deal, log a note._
3. **M3 — Chat/agent.** `/api/chat` streaming + tools, Agent panel, read tools + citations, approve-before-execute for one write (create_lead). _Demo: "add Golub as a lead on 176 Gold" → approve → it appears._
4. **M4 — Agents + reports + map.** LOI Comparison, find-matching-investors, OM/EA extraction (seeded), status report generate, Canvassing map. _Demo: compare offers, generate an owner report, create a pitch from the map._
5. **M5 — Polish + Monday stub.** Empty/loading/error states, `MondayProvider` skeleton mapping to spec §6 column IDs, README with env vars and the swap path.

---

## 7. Non-goals (prototype) & guardrails
- No real Monday writes — `MockProvider` only; `MondayProvider` is a typed stub.
- No real email/e-blast send, no real ESRI key required (MapLibre basemap ok).
- Agent **must not** mutate state without an approved action card; surface every tool call.
- Keep all field mappings traceable to `isg-crm-spec.md §6` (column id comments) so production wiring is mechanical.

## 8. Env & secrets
`ANTHROPIC_API_KEY` (server only). Optional later: `MONDAY_API_TOKEN`, `ESRI_API_KEY`, `MS_GRAPH_*`, `HUBSPOT_*`, `ZOOM_*`. Never expose keys client-side; all model + data calls go through route handlers.

---

*Pair this brief with `isg-crm-spec.md` (schema/IDs) and `screens.html` (visual reference). The microsite's `styles.css` is a ready source of brand tokens.*
