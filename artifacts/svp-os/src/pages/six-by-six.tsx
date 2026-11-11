import { useState } from 'react';
import type { Foundation } from '@workspace/api-client-react';
import { WithFoundation } from '@/components/with-foundation';
import { NextPhaseTag, PageHeader, Panel, StaffAvatar, StatusPill } from '@/components/ui-bits';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { areaById, fmtDate } from '@/lib/format';

function Grid({ data }: { data: Foundation }) {
  const [periodId, setPeriodId] = useState(data.periods[0]?.id ?? '');
  const period = data.periods.find((p) => p.id === periodId);
  const staff = data.staff.filter((s) => s.active);
  const moments = period ? [...period.moments].sort((a, b) => a.position - b.position) : [];

  return (
    <>
      <PageHeader eyebrow="6x6 · Read-only preview" title="Six weeks, six moments."
        actions={data.periods.length > 0 && (
          <Select value={periodId} onValueChange={setPeriodId}>
            <SelectTrigger className="w-60 bg-card" data-testid="select-period"><SelectValue placeholder="Choose period" /></SelectTrigger>
            <SelectContent>
              {data.periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}>
        Major moments for the period, with a column for each teammate. Editing cells arrives in the next phase.
      </PageHeader>

      {!period ? (
        <Panel><p className="text-muted-foreground">No 6x6 periods exist yet.</p></Panel>
      ) : (
        <Panel className="rise p-0 md:p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
            <span className="font-display text-lg font-semibold text-[#0A2540]">{period.name}</span>
            <StatusPill status={period.status} />
            <span className="text-sm text-muted-foreground">{fmtDate(period.startDate)} to {fmtDate(period.endDate)}</span>
            {period.meetingDate && <span className="text-sm text-muted-foreground">· Meeting {fmtDate(period.meetingDate)}</span>}
            <span className="ml-auto"><NextPhaseTag>Editing next phase</NextPhaseTag></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-56 bg-card px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Major moment</th>
                  {staff.map((s) => {
                    const a = areaById(data.areas, s.areaId);
                    return (
                      <th key={s.id} className="px-3 py-3 text-left font-medium">
                        <div className="flex items-center gap-2">
                          <StaffAvatar name={s.name} url={s.avatarUrl} color={a?.color} size="h-7 w-7" />
                          <span className="truncate text-[13px] text-[#0A2540]">{s.name.split(' ')[0]}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {moments.map((m) => (
                  <tr key={m.id} className="border-t border-border transition-colors hover:bg-[#1D8BC4]/[0.04]" data-testid={`row-moment-${m.id}`}>
                    <td className="sticky left-0 z-10 bg-card px-5 py-3">
                      <div className="font-semibold text-[#0A2540]">{m.title}</div>
                      {m.eventDate && <div className="text-[12px] text-muted-foreground">{fmtDate(m.eventDate)}</div>}
                    </td>
                    {staff.map((s) => (
                      <td key={s.id} className="px-3 py-3">
                        <div className="h-10 rounded-md border border-dashed border-border" aria-label="Empty cell" />
                      </td>
                    ))}
                  </tr>
                ))}
                {moments.length === 0 && (
                  <tr><td colSpan={staff.length + 1} className="px-5 py-8 text-center text-muted-foreground">No major moments for this period yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}

export default function SixBySix() {
  return <WithFoundation>{(data) => <Grid data={data} />}</WithFoundation>;
}
