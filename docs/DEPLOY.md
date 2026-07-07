# Deploy — ISG Done Deal Wizard → monday-code

Mirrors how the Retail CRM app is wired. This app is an **Item View** installed on the
**ISG Listings** board (9262635626).

Prereqs (already true on Adrian's machine): `mapps` CLI installed, `~/.config/mapps/.mappsrc`
present (authenticated). If any CLI command returns 401, re-auth with `npx mapps init` using a
token from monday.com → avatar → **Developers → My Access Tokens**.

---

## Part A — Create the app (browser, one-time)

1. **https://developer.monday.com** → **My Apps** → **Create App**.
   Name: `ISG Done Deal Commission Wizard`.
2. In the app → **Features** → **Create feature** → **Item View**.
   (Item View = a tab that shows on an item's card. This is what the wizard is.)
3. Open the feature → note it exists. We'll set its URL after the tunnel/deploy step.
4. **OAuth & Permissions** → add scopes: `me:read`, `boards:read`, `boards:write`,
   `assets:read`. (Needed to read the listing/profiles and create Finance items + upload files.)
5. Note the **App ID** — it's the number in the URL `developer.monday.com/apps/<APP_ID>`.

> ⚠️ Q-PERMS still applies: even with these scopes, writes run under the **signed-in user's**
> session, so whoever uses it needs access to the Finance boards. See `QUESTIONS.md`.

---

## Part B — Test live inside monday (tunnel)

Two terminals, both in this folder:

```bash
cd "/Users/adrianmercado/Documents/Monday Apps/Done_Deal_App"

# Terminal 1 — the app
npm run dev              # serves on http://localhost:8311

# Terminal 2 — tunnel that into monday's iframe
npm run mapps:tunnel     # prints a https://<id>.apps-tunnel.monday.app URL
```

Paste the tunnel URL into **Developer Center → app → Features → (Item View) → View Setup →
Custom URL → Save**. Then open any **ISG Listing item** in monday → the new view tab renders
with **live data** (no `?mock=1` needed inside monday — context supplies the item + session).

> The tunnel URL changes every session — re-paste after restarting the tunnel.

---

## Part C — Deploy to monday-code (production)

```bash
cd "/Users/adrianmercado/Documents/Monday Apps/Done_Deal_App"
npm run mapps:push       # = build:client, then `mapps code:push -d .`
```

`code:push` is interactive the first time — it prompts to pick the app and create a version.
After it finishes:

1. In Developer Center, point the feature's hosting at the **monday-code** deployment
   (or set the Custom URL to the returned monday-code URL).
2. **Promote** the version to **Live**.
3. **Install** the app so the Item View shows on ISG Listings.

For repeat deploys you can pin the version id like the Retail CRM does:
`mapps code:push -i <appVersionId>` (add it to the `deploy` script once you have the id).

---

## First real submit (do this before trusting it)

Open the view on **one throwaway ISG listing** in "5. Closing Review", run all 7 steps, submit,
and confirm the Done Deal + subitems + A/R rows land correctly in the Finance boards. Only then
use it on real deals. (Adrian's standing rule: test with 1 item first.)
