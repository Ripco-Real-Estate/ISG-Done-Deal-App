# CLAUDE.md — ISG CRM prototype

Project guide for Claude Code. Read this first, then `docs/isg-crm-features-build-brief.md` (the build plan) and `docs/isg-crm-spec.md` (board schema + exact column IDs).

## What this is
A functional prototype of the **ISG CRM** — a Lev-style application for RIPCO's Investment Sales Group that replaces the native Monday.com CRM UI with purpose-built screens, plus an embedded **Claude chat/agent**. Monday.com stays the server-side system of record; for the prototype we run on **mock data** behind a `DataProvider` interface that can later swap to the live Monday API.

## Source of truth (read order)
1. `docs/isg-crm-features-build-brief.md` — features (user story + acceptance criteria), IA, chat/agent spec, stack, milestones. **This is the spec to build to.**
2. `docs/isg-crm-spec.md` — the 8 Monday boards with real board IDs, column IDs, types, statuses, relationships. **Use these IDs in type comments and the Monday provider.**
3. `docs/reference-microsite/` — visual reference (open `screens.html` and `index.html` in a browser). `styles.css` holds the navy/gold brand tokens to reuse.

## Stack (intended)
Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui (Radix) · TanStack Table · dnd-kit (kanban) · TanStack Query · MapLibre GL (Canvassing, swappable to Esri) · `@anthropic-ai/sdk` (chat, server-only) · `docx` (status reports) · Zustand (approval/mock-write state).

## Architecture rules (do not violate)
- **All data access goes through `lib/data/provider.ts`.** UI never imports a concrete provider; it uses the injected `DataProvider`. Ship `MockProvider` (reads `lib/data/seed/*.json`); keep `MondayProvider` a typed stub.
- **Every entity field keeps a `// <columnId>` comment** mapping to `docs/isg-crm-spec.md §6` so the Monday wiring is mechanical later.
- **Agent writes are gated.** Read tools auto-run; any write tool returns a proposed-action card that the user must Approve before state mutates. Never mutate on a raw tool call.
- **Scoped visibility.** Default to "my items" using person columns (Lead/Team/Visibility). No full-board fallback when a scoped query is empty.
- **Secrets are server-only.** `ANTHROPIC_API_KEY` (and any future Monday/Esri/M365/HubSpot/Zoom keys) are read only in route handlers, never shipped to the client.

## Where things go
```
app/(app)/…        screens (pipeline, listings/[id], pitches, contacts, companies,
                   lists, leads, properties, canvassing, agreements, reports)
app/api/chat       Claude streaming + tool-use loop
app/api/tools      executes tool calls against the DataProvider
lib/types          entity types (mirror the 8 boards)
lib/data           provider.ts (interface) · mock-provider.ts · monday-provider.ts · seed/
lib/agents         tools.ts (tool/function defs) · system-prompts.ts · presets
components/chrome   Sidebar, Topbar, AgentPanel, CommandK
components/views    DataTable, FilterBar, Kanban, RecordDetail, RightRail, ActivityFeed
components/agent    ChatThread, Message, ToolCallCard, CitationChip, ApprovalCard
components/ui        shadcn primitives
docs/               specs + reference microsite (do not delete)
```

## Build milestones (see brief §6)
M1 shell + data layer (pipeline + listing detail, read) → M2 CRM + leads + writes → M3 chat/agent (streaming, tools, one gated write) → M4 agents + reports + map → M5 polish + Monday stub.
Work milestone by milestone; keep each demoable.

## Conventions
- TypeScript strict. No `any` in the data layer. Prefer server components for reads, client components for interactive views.
- Brand tokens from `docs/reference-microsite/styles.css`: navy `#0c1a2e`, gold `#c9a24b`; status pills map to Monday hexes (green `#00c875`, orange `#fdab3d`, red `#df2f4a`, blue `#579bfc`, purple `#a25ddc`, navy `#225091`).
- Seed data uses the names already in the microsite (176 Gold Street, Harbor Point, Golub, Redwood, Silverpeak) for continuity.

## Commands
- `npm install` — install deps
- `npm run dev` — start (http://localhost:3000)
- `npm run build` / `npm run lint`

## First task for Claude Code
Scaffold M1: implement `MockProvider` + seed JSON for listings & leads, build the app shell (Sidebar/Topbar from `components/chrome`), the Pipeline kanban (PIPE-1/2), and the listing detail (DEAL-1/2) reading through the provider. Then stop and confirm before M2.

## Guardrails
- Prototype only: no real Monday writes, no real email send, MapLibre basemap is fine (no Esri key required).
- Don't delete `docs/`. Don't hardcode data in components — go through the provider.
- If a decision isn't covered here or in the brief, prefer the brief; if still ambiguous, ask.
