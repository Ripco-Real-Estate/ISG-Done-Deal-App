# ISG Done Deal App — build notes

monday.com **Item View** installed on **ISG Listings** (9262635626). A 7-step wizard that
finalizes a closed listing into the Finance boards. Real coded app (Vite + React + TS +
`monday-sdk-js`), deployed to monday-code via `mapps`. NOT a Vibe app.

## Non-negotiables
- **`docs/COLUMN-MAP.md` is law.** It was verified live 2026-07-06 and corrects ~12 wrong
  IDs in the original spec. Never trust the spec's column IDs over it. `src/lib/donedeal/columns.ts`
  mirrors it — change both together.
- **Never mutate board structure.** Values only. No column/board/label creation or edits, ever.
- **Write dropdowns/statuses by label text**, not numeric id (live ids are quirky/reversed).
- **Profiles never block the UI.** Only the item load blocks first paint. No loading screen
  during file uploads.
- **Submit = 5 sequential writes, stop-on-failure, no rollback**, retry-from-failed-step. Hold
  created IDs in state so retries never double-create.
- **Test with 1 throwaway listing first** before trusting a real submit (Adrian's rule).

## UI contract — follow RIPCO UI
- **Canonical design system: [`../RIPCO-UI.md`](../RIPCO-UI.md)** (workspace root) — the ONE cross-app
  language for every RIPCO app. It wins over anything here for tokens/tones/components/UX rules.
  This app never forks or overrides it; when in doubt, read RIPCO-UI.
- **Start-of-build:** tokens + `globals.css` classes come from RIPCO-UI §17.9 (starter kit);
  build the shared primitives from §16, or copy them from the reference implementation at
  `../Retail_CRM_App/monday-app/src/components/ui/` + `components/shared/`.
- **The essentials:** single blue `#2563eb` (no `#579bfc`); 8 token-derived status tones via one
  `Pill`; Tabler outline icons; sentence case; hairline borders; `InlineField` click-to-edit;
  `DetailDrawer` defaults to 95vw; light + dark both required; no `position:fixed` in the iframe.
- **Source-of-truth caveat:** this is a standalone git repo, so the relative `../RIPCO-UI.md` path
  only resolves inside the `Monday Apps/` workspace. If this repo is ever cloned on its own, pull a
  version-stamped copy of RIPCO-UI per the governance model (§19) — never hand-edit a local copy.

## Commands
- `npm run dev` — Vite dev server (:8311)
- `npm run typecheck` / `npm test` — TS + Vitest
- `npm run build` — typecheck + production build to `dist/`
- `npm run mapps:tunnel` — local tunnel for in-monday testing
- `npm run mapps:push` — build + push to monday-code (needs app registered first — see QUESTIONS.md)

## Layout
`src/lib/monday/sdk.ts` (api wrapper) · `src/lib/donedeal/{columns,types,compute,read,submit,storage}.ts`
· `src/components/steps/*` (7 steps) · `src/components/ui/*` (primitives) · `src/App.tsx` (shell).
