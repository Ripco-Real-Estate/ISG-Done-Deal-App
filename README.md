# ISG Done Deal Commission Wizard

A monday.com **Item View** for the **ISG Listings** board. When a listing hits the
"5. Closing Review" stage, brokers run a 7-step wizard to finalize the deal — documents,
metrics, parties, deductions, and commission splits — which then writes the finalized record
into three Finance-workspace boards (Done Deals, its Subitems, and A/R Schedules).

Built as a real coded monday app: **Vite + React 18 + TypeScript + Tailwind + monday-sdk-js**,
hosted on monday-code.

## Quick start

```bash
npm install
npm run dev          # local dev at http://localhost:8311
npm run typecheck    # TypeScript
npm test             # Vitest (commission math + validation)
npm run build        # production build to dist/
```

## Deploy (monday-code)

```bash
npm run mapps:login  # one-time auth
npm run mapps:tunnel # test live inside monday
npm run mapps:push   # build + push (requires a registered app — see docs/QUESTIONS.md Q-DEPLOY)
```

## Docs

- `docs/superpowers/specs/2026-07-06-done-deal-wizard-design.md` — design spec
- `docs/COLUMN-MAP.md` — **verified** column IDs (source of truth; corrects the original spec)
- `docs/QUESTIONS.md` — open questions for Adrian
- `ISG Done Deal Commission Wizard — Full Rebuild Specification.md` — original source spec

> **Two hard rules:** the live board schema wins over the spec, and the app never changes
> board structure — it writes item values only.
