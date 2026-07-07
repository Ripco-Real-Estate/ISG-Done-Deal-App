import { StatCard } from '@/components/ui/primitives';
import { money } from '@/lib/utils/cn';
import { num } from '@/lib/donedeal/compute';
import type { FormData } from '@/lib/donedeal/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-06-30" → "Jun 30, 2026" (manual parse — no TZ off-by-one). */
function shortDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return '';
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/**
 * Persistent deal-context strip (RIPCO-UI §9.9 detail order: identity → stats
 * before content). Values derive live from the form, so editing Scheduled
 * Commission on step 3 updates the strip the broker reads on steps 5–6.
 */
export function DealContextStrip({ form }: { form: FormData }) {
  const price = num(form.dealDetails.finalSalesPrice);
  const comm = num(form.dealDetails.scheduledCommission);
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border px-5 py-2 sm:grid-cols-4">
      <StatCard label="Sales price" value={price ? money(price) : ''} numeric />
      <StatCard label="Sched. commission" value={comm ? money(comm) : ''} numeric />
      <StatCard label="Close date" value={shortDate(form.dealDetails.actualCloseDate)} numeric />
      <StatCard label="Property type" value={form.metrics.propertyType} />
    </div>
  );
}
