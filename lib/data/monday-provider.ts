// MondayProvider — PRODUCTION stub. Do not implement for the prototype.
// When wiring live: call the Monday GraphQL API and map fields using the
// column IDs documented in docs/isg-crm-spec.md §6 and commented in lib/types/entities.ts.
//
// Board IDs (spec §6):
//   ContactsISG          9262635615
//   Companies            9526814002
//   My Lists             9871281018
//   ISG Pitch Tracker    9262635627
//   ISG Listings         9262635626
//   ISG Leads Tracker    9263596898
//   Properties Database  9262635619
//   Exclusive Agreements 18405710371
//
// Auth: process.env.MONDAY_API_TOKEN (server-only). Respect scoped visibility
// (person columns) — never widen access beyond the user's Monday permissions.
// Writes must post a create_update audit entry to the parent item.

import type { DataProvider } from "./provider";

export class MondayProvider implements DataProvider {
  // Intentionally unimplemented in the prototype.
  // Implement each method to satisfy the DataProvider contract using the IDs above.
  [k: string]: any;
  constructor() {
    return new Proxy(this, {
      get(_t, prop: string) {
        return async () => {
          throw new Error(`MondayProvider.${prop} not implemented — prototype uses DATA_PROVIDER=mock`);
        };
      },
    });
  }
}
