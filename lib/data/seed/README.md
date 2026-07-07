# Seed data

Mock JSON shaped per the 8 Monday boards (`docs/isg-crm-spec.md §6`). `MockProvider`
reads these files. Build during M1 (brief §3).

Create one file per entity:
- `listings.json` — ~25 across all stages (00. New → Done Deal)
- `leads.json` — ~120, each with a `listingId` (listing-scoped)
- `pitches.json` — ~60 across pitch stages
- `contacts.json` — ~300, typed (Owner/Investor/Attorney…), some with Investor Criteria
- `companies.json` — ~80
- `lists.json` — ~10
- `properties.json` — ~200 (NYC + FL) with `latLong` for the Canvassing map
- `agreements.json` — ~15 with AI-extracted fields populated
- `users.json` — a few brokers + a current user (drives scoping)

Reuse the microsite names for continuity: 176 Gold Street, Harbor Point Plaza,
945 Madison Ave, Mesa Crossing, Golub Capital, Redwood Partners, Silverpeak.
Match each field to a type in `lib/types/entities.ts` (which carries the Monday column IDs).
