import { useRef, useState } from 'react';
import { IconPaperclip, IconUpload, IconLoader2 } from '@tabler/icons-react';
import { uploadFileToColumn } from '@/lib/donedeal/files';
import type { UploadedFile } from '@/lib/donedeal/types';
import { Pill } from '@/components/ui/primitives';

/**
 * One document upload slot. Uploads to an ISG Listings `file` column, then
 * reports the asset up so form state records it (no refetch → no loading flash).
 * RIPCO UI: status lives in the pill, never as a tinted row background (§2.5);
 * neutral card row, hairline border, secondary upload button.
 */
export function FileSlot({
  label,
  columnId,
  itemId,
  required,
  files,
  onUploaded,
  onUploadingChange,
}: {
  label: string;
  columnId: string;
  itemId: string;
  required?: boolean;
  files: UploadedFile[];
  onUploaded: (file: UploadedFile) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const has = files.length > 0;

  async function upload(file: File) {
    setError(null);
    setPending(true);
    onUploadingChange?.(true);
    try {
      const asset = await uploadFileToColumn(itemId, columnId, file);
      onUploaded({ id: asset.id, name: asset.name, url: asset.url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload the file.");
    } finally {
      setPending(false);
      onUploadingChange?.(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-button border border-border bg-white p-[10px] pl-[12px]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-ink">{label}</span>
          {has ? (
            <Pill tone="green" dot>Uploaded</Pill>
          ) : required ? (
            <Pill tone="red" dot>Required</Pill>
          ) : (
            <Pill tone="gray">Optional</Pill>
          )}
        </div>
        {has && (
          <div className="mt-[3px] flex items-center gap-1 text-[12px] text-muted">
            <IconPaperclip size={12} aria-hidden />
            <span className="truncate">{files.map((f) => f.name).join(', ')}</span>
          </div>
        )}
        {error && <p className="mt-[3px] text-[12px] text-brand-red">{error}</p>}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-button border border-border-strong bg-white px-2 text-[12px] font-medium text-ink transition-colors hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-55"
      >
        {pending ? <IconLoader2 size={13} className="animate-spin" aria-hidden /> : <IconUpload size={13} aria-hidden />}
        {has ? 'Replace' : 'Upload'}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        aria-label={`Upload ${label}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
