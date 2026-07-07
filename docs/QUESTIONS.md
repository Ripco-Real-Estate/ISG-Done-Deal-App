# Open Questions — Done Deal Wizard

Collected during the initial prototype build (2026-07-06). Grouped by whether they
**block** a real submission, are **decisions** I made a call on (confirm or override), or are
**nice-to-know**. Nothing here blocks reviewing the prototype — they block flipping it on live.

---

## 🔴 Blockers — must resolve before a live submit

### Q-DEPLOY — App registration in monday Developer Center
The app needs to be registered before `mapps code:push` has a target:
- Create the app, add an **Item View** feature, install it on **ISG Listings** (9262635626).
- That yields the app id used by `npm run mapps:push`.
- **Who does this?** It's a Developer Center action (you/admin). I can walk through it, but I
  can't create the app registration from here.

### Q-PERMS — Do brokers have write access to the Finance boards?
This is the big one. The app writes **under the running user's monday session**. Submission
creates items on **Done Deals**, **Subitems**, and **A/R Schedules** (Finance workspace) and
reads **Broker Profiles**. If a broker's account can't write to those boards, step 2–5 fail for
them even though it works for you.
- **Option A:** grant brokers the needed board access (simplest if acceptable).
- **Option B:** run the Finance writes through a monday-code **backend with a stored service
  token / app-level OAuth**, so the app — not the individual broker — owns those writes. This is
  more work (adds a small backend) but keeps broker permissions locked down.
- Which model do you want? (Affects architecture — right now it's pure client-side.)

---

## 🟠 Decisions I made — confirm or override

### Q-SUBITEM-LABELS — participant / split-type labels
Live Subitem labels are: Participant Type = {Originator, Internal Referral, Team Member,
Co-Broker, External Referral}, Split Type = {Team Split, House Deal, Regular Split}.
- I write **"Team Member"** for non-originators and **"Team Split"** for non-house rows (matches
  the source spec). Should regular splits be **"Team Split"** or **"Regular Split"**?

### Q-HOUSE-PRINCIPALS — exact Broker Profile names
House-deal principals are **Todd Cooper, Mark Kaplan, Peter Ripka**. I match them to Broker
Profiles by exact name to link the subitem's profile relation. If a name differs on the board
(e.g. "Peter Ripka" vs "Pete Ripka"), the subitem is still created but without the profile link.
- Confirm the three profiles exist and are **Active** with those exact names.

### Q-SUBMITTED-BY — people-column write format
I write the Done Deal "Submitted By" as `{personsAndTeams:[{id,kind:"person"}]}` using the
current user id. This is the standard format but I haven't fired it live yet — will confirm on
the first test submit. If your account isn't the submitter you want recorded, tell me.

### Q-DROPDOWN-BY-LABEL — writing statuses/dropdowns by label
I deliberately write every status/dropdown by **label text** (not numeric id) because the live
ids are quirky (Transaction Type ids 2–5; Co-Broker Yes=1/No=2 but Referral No=1/Yes=2). This is
safer and needs no board changes. Flagging only so you know why the code looks that way.

### Q-NOT-ON-DONE-DEALS — metrics that live only on the listing
Cap Rate, Total Units, Is Development, Is Multi-Property have **no columns on the Done Deals
board**, so they're written to the **listing** at submit and omitted from the Done Deal record
(the source spec tried to put them on Done Deals — those IDs were actually paid-directly
checkboxes / Net-to-RIPCO). Confirm Finance doesn't need them on the Done Deal itself.

---

## 🟡 Nice-to-know / verify on first test

- **Q-CLOSE / Q-OPEN-CARD** — the success screen's "Close" button and the "Done Deal ID" link
  use `monday.execute(...)`. Exact behavior for an Item View I'll confirm live; they degrade
  gracefully if unsupported.
- **Q-GROUP** — ✅ resolved: both Done Deals and A/R use group id `topics` (verified live).
- **Q-TEST-LISTING** — which throwaway ISG listing should I run the first real end-to-end submit
  against? (Your standing rule: test with 1 item first. I will not fire a real submit until you
  name one.)
- **Q-SF-ON-DONE-DEAL** — Done Deals has a "Square Footage" column (`numeric_mm335hjf`). Should
  ISG sale deals populate it, or leave it (it's more of a lease-comp field)? Currently unmapped.
