# ISG CRM Prototype

A Lev-style application for RIPCO's **Investment Sales Group** — purpose-built CRM/Pipeline/Leads screens plus an embedded **Claude chat/agent**, built on top of the Monday.com "10. ISG CRM" workspace (server-side). This repo is a **functional prototype** running on mock data behind a swappable data provider.

## Quick start
```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

## Documentation
- `docs/isg-crm-features-build-brief.md` — **build plan**: features, IA, chat/agent spec, milestones.
- `docs/isg-crm-spec.md` — **board schema**: the 8 Monday boards, real column IDs, relationships.
- `docs/reference-microsite/` — visual reference (open `screens.html`, `index.html`).
- `CLAUDE.md` — instructions for Claude Code (architecture rules, conventions, where things go).

## Architecture (one line)
Claude-built UI → `DataProvider` (mock now, Monday later) → seed data; chat via `@anthropic-ai/sdk` in `app/api/chat` with gated write tools.

## Status
Scaffold only. Build proceeds in milestones M1–M5 (see brief §6 / `CLAUDE.md`).
