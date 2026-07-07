import type { FormData } from '@/lib/donedeal/types';
import { computeWaterfall } from '@/lib/donedeal/compute';
import { money } from '@/lib/utils/cn';

/** Read-only commission waterfall (source spec §8.5). Neutral inset well;
 *  numbers tabular; no decorative color (§0.6). */
export function Waterfall({ form }: { form: FormData }) {
  const wf = computeWaterfall(form);
  const rows: Array<{ label: string; value: number; sub?: boolean; strong?: boolean }> = [
    { label: 'Full commission', value: wf.fullCommission, strong: true },
  ];
  if (form.deductions.coBroker === 'Yes') rows.push({ label: '− Co-broker fee', value: -wf.coBrokerFee, sub: true });
  rows.push({ label: '= Net to RIPCO', value: wf.netToRipco });
  if (form.deductions.referral === 'Yes') rows.push({ label: '− Referral fee', value: -wf.referralFee, sub: true });
  if (wf.concessions) rows.push({ label: '− Concessions', value: -wf.concessions, sub: true });
  rows.push({ label: '= Gross commission', value: wf.grossCommission, strong: true });

  return (
    <div className="rounded-card border border-border bg-bg-subtle p-[14px]">
      <p className="field-label mb-[8px] !text-muted">Commission waterfall</p>
      <dl className="space-y-[5px]">
        {rows.map((r, i) => (
          <div key={i} className="flex items-baseline justify-between">
            <dt
              className={`text-[12.5px] ${r.sub ? 'pl-3 text-muted' : 'text-ink'} ${r.strong ? 'font-medium' : ''}`}
            >
              {r.label}
            </dt>
            <dd className={`num text-[13px] ${r.strong ? 'font-semibold text-ink' : 'text-ink'}`}>
              {money(r.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
