// Claude tool (function) definitions for the chat/agent.
// Read tools auto-run; WRITE tools require an approved action card before mutating
// (brief §5.3). Handlers dispatch to the DataProvider in app/api/tools.

import type Anthropic from "@anthropic-ai/sdk";

export const READ_TOOLS = [
  "search_records", "get_listing", "list_leads", "get_contact",
  "find_matching_investors", "compare_offers", "get_market_comps", "read_document",
] as const;

export const WRITE_TOOLS = [
  "create_lead", "update_lead_status", "move_listing_stage", "create_pitch",
  "log_activity", "draft_email", "generate_status_report", "request_bov",
] as const;

export type ToolName = (typeof READ_TOOLS)[number] | (typeof WRITE_TOOLS)[number];

export function isWriteTool(name: string): boolean {
  return (WRITE_TOOLS as readonly string[]).includes(name);
}

export const tools: Anthropic.Tool[] = [
  // ---- read (auto) ----
  {
    name: "search_records",
    description: "Search listings, contacts, companies, and properties by free text.",
    input_schema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
  },
  {
    name: "get_listing",
    description: "Fetch a listing with its leads, offers, owner, dates, and EA status.",
    input_schema: { type: "object", properties: { listingId: { type: "string" } }, required: ["listingId"] },
  },
  {
    name: "list_leads",
    description: "List the leads (buyers/interested parties) for a listing.",
    input_schema: { type: "object", properties: { listingId: { type: "string" } }, required: ["listingId"] },
  },
  {
    name: "get_contact",
    description: "Fetch a contact with company, deal history, and activity.",
    input_schema: { type: "object", properties: { contactId: { type: "string" } }, required: ["contactId"] },
  },
  {
    name: "find_matching_investors",
    description: "Rank contacts whose Investor Criteria (markets, property type, deal size) match a listing.",
    input_schema: { type: "object", properties: { listingId: { type: "string" }, limit: { type: "number" } }, required: ["listingId"] },
  },
  {
    name: "compare_offers",
    description: "Normalize the offers/LOIs on a listing into a comparison table with a recommendation and risk flags.",
    input_schema: { type: "object", properties: { listingId: { type: "string" } }, required: ["listingId"] },
  },
  {
    name: "get_market_comps",
    description: "Return comparable sales for a property type and area (seeded in the prototype).",
    input_schema: { type: "object", properties: { propertyType: { type: "string" }, area: { type: "string" } }, required: ["propertyType"] },
  },
  {
    name: "read_document",
    description: "Extract structured fields from an OM / rent roll / EA (seeded extraction in the prototype). Returns field, value, source page, confidence.",
    input_schema: { type: "object", properties: { fileId: { type: "string" }, docType: { type: "string", enum: ["OM", "RentRoll", "EA", "T12"] } }, required: ["fileId"] },
  },

  // ---- write (require approval) ----
  {
    name: "create_lead",
    description: "Create a listing-scoped lead. REQUIRES user approval before it is applied.",
    input_schema: {
      type: "object",
      properties: {
        listingId: { type: "string" }, contactName: { type: "string" },
        company: { type: "string" }, status: { type: "string" }, interestLevel: { type: "string" },
      },
      required: ["listingId", "contactName"],
    },
  },
  {
    name: "update_lead_status",
    description: "Move a lead's status in the funnel. REQUIRES approval.",
    input_schema: { type: "object", properties: { leadId: { type: "string" }, status: { type: "string" } }, required: ["leadId", "status"] },
  },
  {
    name: "move_listing_stage",
    description: "Change a listing's pipeline stage. REQUIRES approval.",
    input_schema: { type: "object", properties: { listingId: { type: "string" }, stage: { type: "string" } }, required: ["listingId", "stage"] },
  },
  {
    name: "create_pitch",
    description: "Create a Pitch Tracker item (e.g. from a canvassing pin). REQUIRES approval.",
    input_schema: { type: "object", properties: { propertyId: { type: "string" }, note: { type: "string" } }, required: ["propertyId"] },
  },
  {
    name: "request_bov",
    description: "Request a BOV analysis on a pitch and assign a point person. REQUIRES approval.",
    input_schema: { type: "object", properties: { pitchId: { type: "string" }, instructions: { type: "string" } }, required: ["pitchId"] },
  },
  {
    name: "draft_email",
    description: "Draft a context-aware email to a contact (does not send). REQUIRES approval to log.",
    input_schema: { type: "object", properties: { contactId: { type: "string" }, listingId: { type: "string" }, intent: { type: "string" } }, required: ["contactId"] },
  },
  {
    name: "generate_status_report",
    description: "Assemble an owner status report for a listing from Pipeline + Leads data. REQUIRES approval.",
    input_schema: { type: "object", properties: { listingId: { type: "string" } }, required: ["listingId"] },
  },
  {
    name: "log_activity",
    description: "Log a note/activity on a record (audit trail). REQUIRES approval.",
    input_schema: { type: "object", properties: { board: { type: "string" }, itemId: { type: "string" }, note: { type: "string" } }, required: ["board", "itemId", "note"] },
  },
];
