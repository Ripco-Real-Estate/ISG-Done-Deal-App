import { api } from '../monday/sdk';
import { BOARDS, CONTACT } from './columns';
import { isMockMode, MOCK_CONTACTS } from './mock';

/**
 * Name-contains lookup over the ISG Contacts board (9262635615). READ-ONLY:
 * selecting a hit fast-fills party fields — no link is stored and this app
 * never creates or edits contacts (that's the isg-intake skill's job).
 */
export interface ContactHit {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  type: string;
}

interface RawContactItem {
  id: string;
  name: string;
  column_values: Array<{ id: string; text: string | null }>;
  company: Array<{ display_value?: string | null }>;
}

export function mapContactItems(items: RawContactItem[]): ContactHit[] {
  return items.map((it) => {
    const t = (id: string) => (it.column_values.find((c) => c.id === id)?.text ?? '').trim();
    return {
      id: it.id,
      name: it.name,
      company: (it.company?.[0]?.display_value ?? '').trim() || t(CONTACT.companyText),
      email: t(CONTACT.email),
      phone: t(CONTACT.cellPhone) || t(CONTACT.officePhone),
      type: t(CONTACT.type),
    };
  });
}

const SEARCH_QUERY = `
  query SearchContacts($board: ID!, $term: CompareValue!, $cols: [String!], $rel: [String!]) {
    boards(ids: [$board]) {
      items_page(
        limit: 8
        query_params: { rules: [{ column_id: "name", compare_value: $term, operator: contains_text }] }
      ) {
        items {
          id
          name
          column_values(ids: $cols) { id text }
          company: column_values(ids: $rel) {
            ... on BoardRelationValue { display_value }
          }
        }
      }
    }
  }`;

/**
 * Search contacts by name. <2 chars → []. Errors → [] (lookup is a convenience,
 * never a blocker). Mock mode filters canned results — zero API calls.
 */
export async function searchContacts(term: string): Promise<ContactHit[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  if (isMockMode()) {
    const t = q.toLowerCase();
    return MOCK_CONTACTS.filter((c) => c.name.toLowerCase().includes(t)).slice(0, 8);
  }
  try {
    const data = await api<{ boards: Array<{ items_page: { items: RawContactItem[] } }> }>(SEARCH_QUERY, {
      board: BOARDS.contacts,
      term: [q],
      cols: [CONTACT.email, CONTACT.cellPhone, CONTACT.officePhone, CONTACT.type, CONTACT.companyText],
      rel: [CONTACT.companyRelation],
    });
    return mapContactItems(data.boards?.[0]?.items_page?.items ?? []);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[contacts] search failed — free-text fallback', e);
    return [];
  }
}
