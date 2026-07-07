import mondaySdk from 'monday-sdk-js';

/**
 * Single monday SDK instance for the whole app. API version pinned to 2026-04
 * (same as the Retail CRM) so board_relation / mirror read shapes are stable.
 *
 * There is NO context-bound "BoardSDK" here — the Vibe gotcha about the SDK
 * only working on the installed board does not apply to a coded app. Every
 * board (ISG Listings, Done Deals, A/R, Profiles) is reached through this one
 * `api()` wrapper.
 */
const monday = mondaySdk();
monday.setApiVersion('2026-04');
export { monday };

export interface MondayApiError {
  message: string;
  extensions?: { code?: string; error_data?: unknown };
  path?: Array<string | number>;
}

/**
 * Thin wrapper over monday.api() that surfaces GraphQL errors as thrown
 * Errors with the *failing column/payload* in the message. Generic monday
 * error strings are useless without that context.
 */
export async function api<T = unknown>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = (await monday.api(query, { variables })) as
    | {
        data?: T;
        errors?: MondayApiError[];
      }
    | undefined;
  if (!res) {
    throw new Error('No response from monday API — is the app running inside the monday iframe?');
  }
  if (res.errors?.length) {
    // eslint-disable-next-line no-console
    console.error('[monday api] errors', {
      errors: res.errors,
      variables,
      query: query.trim().split('\n')[0] + '…',
    });
    const detail = res.errors
      .map((e) => {
        const ed = e.extensions?.error_data;
        return `${e.message}${ed ? ` (${JSON.stringify(ed)})` : ''}`;
      })
      .join('; ');
    throw new Error(detail);
  }
  if (!res.data) throw new Error('Empty response from monday API');
  return res.data;
}

/** Is monday.api actually callable yet? (It can be briefly undefined on first render.) */
export function apiReady(): boolean {
  return typeof monday?.api === 'function';
}
