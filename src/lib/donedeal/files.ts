import { monday } from '../monday/sdk';
import { isMockMode } from './mock';

/**
 * Upload a file to an ISG Listings `file` column via add_file_to_column.
 * The SDK handles the multipart serialization when `file` is passed as a
 * GraphQL variable. Files live on the listing and are linked to the Done Deal
 * via board relation — monday can't copy files across boards in create_item.
 */
const ADD_FILE_TO_COLUMN_GQL = `
  mutation AddFileToColumn($itemId: ID!, $columnId: String!, $file: File!) {
    add_file_to_column(item_id: $itemId, column_id: $columnId, file: $file) {
      id
      name
      url
    }
  }`;

export interface UploadedAsset {
  id: string;
  name: string;
  url: string;
}

export async function uploadFileToColumn(
  itemId: string,
  columnId: string,
  file: File,
): Promise<UploadedAsset> {
  // Local preview: no monday host to accept the upload. Simulate success so the
  // wizard is testable end-to-end on localhost (mock contract: no API calls).
  if (isMockMode()) {
    return { id: `mock-${Date.now()}`, name: file.name, url: '#' };
  }

  const res = (await monday.api(ADD_FILE_TO_COLUMN_GQL, {
    variables: { itemId, columnId, file },
  })) as
    | {
        data?: { add_file_to_column?: UploadedAsset };
        errors?: Array<{ message: string }>;
      }
    | undefined;
  if (!res) {
    throw new Error(
      'No response from monday — file uploads only work inside the monday iframe. Use ?mock=1 to preview locally.',
    );
  }
  if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join('; '));
  const asset = res.data?.add_file_to_column;
  if (!asset) throw new Error('Upload returned no asset');
  return asset;
}
