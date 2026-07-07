import { describe, it, expect, vi, afterEach } from 'vitest';

// Spy for monday.api so we can assert it is NOT called in mock mode, and
// simulate the "no monday host" (undefined) return you get outside the iframe.
const apiMock = vi.fn();
vi.mock('../monday/sdk', () => ({
  monday: { api: (...args: unknown[]) => apiMock(...args) },
}));

import { uploadFileToColumn } from './files';

// files.ts only reads file.name on the mock path; avoid depending on a global File.
const file = { name: 'deed.pdf' } as unknown as File;

describe('uploadFileToColumn', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    apiMock.mockReset();
  });

  it('mock mode (?mock=1): returns a synthetic asset and never calls monday.api', async () => {
    (globalThis as { window?: unknown }).window = { location: { search: '?mock=1' } };
    const asset = await uploadFileToColumn('mock-listing', 'files', file);
    expect(apiMock).not.toHaveBeenCalled();
    expect(asset.name).toBe('deed.pdf');
    expect(asset.id).toBeTruthy();
  });

  it('outside the iframe (api resolves undefined): throws a legible error, not "reading errors"', async () => {
    apiMock.mockResolvedValue(undefined);
    await expect(uploadFileToColumn('123', 'files', file)).rejects.toThrow(/monday/i);
    apiMock.mockResolvedValue(undefined);
    await expect(uploadFileToColumn('123', 'files', file)).rejects.not.toThrow(
      /Cannot read properties of undefined/,
    );
  });
});
