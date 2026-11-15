import { useMemo, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react';
import type { Foundation, ScorecardMetric } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { WithFoundation } from '@/components/with-foundation';
import { ErrorPanel, PageHeader, PageSkeleton, Panel } from '@/components/ui-bits';
import { NativeSelect } from '@/components/native-select';
import { MetricDialog, type KrOption } from '@/components/scorecard/metric-dialog';
import { EntryDialog } from '@/components/scorecard/entry-dialog';
import { ScorecardTable, type KrLink } from '@/components/scorecard/scorecard-table';
import { useStaffSession } from '@/lib/session-context';
import { useOkrWorkspace } from '@/lib/okr';
import { isQbo } from '@/lib/qbo';
import {
  addWeeks, buildCsv, bySortTitle, currentMonday, downloadCsv, isMonday, metricToInput, revisionsFor, useScorecard, useScorecardActions, weekLabel,
} from '@/lib/scorecard';
import { errorMessage } from '@/lib/format';

const ALL = 'all';

function ScorecardBody({ foundation }: { foundation: Foundation }) {
  const me = useStaffSession();
  const isAdmin = me.role === 'admin';
  const search = useSearch();
  const [, setLocation] = useLocation();
  const sp = new URLSearchParams(search);
  const today = currentMonday();
  const rawEnd = sp.get('week');
  const endWeek = isMonday(rawEnd) && rawEnd < today ? rawEnd : undefined;
  const owner = sp.get('owner') ?? ALL;
  const area = sp.get('area') ?? ALL;
  const showArchived = sp.get('archived') === '1';

  const q = useScorecard(endWeek);
  const okr = useOkrWorkspace();
  const actions = useScorecardActions();
  const [metricOpen, setMetricOpen] = useState(false);
  const [editing, setEditing] = useState<ScorecardMetric | null>(null);
  const [cell, setCell] = useState<{ metricId: string; week: string } | null>(null);

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(search);
    Object.entries(patch).forEach(([k, v]) => (v == null || v === ALL ? next.delete(k) : next.set(k, v)));
    const s = next.toString();
    setLocation(`/scorecard${s ? `?${s}` : ''}`);
  };

  const { krOptions, krLinks } = useMemo(() => {
    const opts: KrOption[] = [];
    const links: Record<string, KrLink> = {};
    const ws = okr.data;
    if (ws) {
      for (const k of ws.keyResults) {
        const o = ws.objectives.find((x) => x.id === k.objectiveId);
        if (!o || !isQbo(o)) continue;
        links[k.id] = { objectiveId: o.id, label: `${o.timeScope} ${k.title}` };
        if (k.measurementType === 'metric' && o.status === 'active') opts.push({ id: k.id, label: k.title, objectiveTitle: o.title, quarter: o.timeScope });
      }
    }
    return { krOptions: opts, krLinks: links };
  }, [okr.data]);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const sc = q.data;
  const all = [...sc.metrics].sort(bySortTitle);
  const activeSorted = all.filter((m) => m.active);
  const visible = all.filter((m) => (showArchived || m.active) && (owner === ALL || m.ownerId === owner) && (area === ALL || m.areaId === area));
  const staffName = (id: string) => foundation.staff.find((s) => s.id === id)?.name ?? 'Unknown';
  const winStart = sc.weeks[0];
  const winEnd = sc.weeks[sc.weeks.length - 1];
  const atToday = sc.endWeek >= today;
  const newer = addWeeks(sc.endWeek, 13);
  const archivedCount = all.length - activeSorted.length;

  const cellMetric = cell ? all.find((m) => m.id === cell.metricId) : undefined;
  const cellEntry = cell ? sc.entries.find((e) => e.metricId === cell.metricId && e.weekStart === cell.week) : undefined;

  const move = async (index: number, dir: -1 | 1) => {
    const a = visible[index]; const b = visible[index + dir];
    if (!a || !b) return;
    if (a.sortOrder !== b.sortOrder) {
      const r = await actions.updateMetric(a.id, { ...metricToInput(a), sortOrder: b.sortOrder }, 'Order updated');
      if (r.ok) await actions.updateMetric(b.id, { ...metricToInput(b), sortOrder: a.sortOrder }, 'Order updated');
      return;
    }
    const list = [...all]; const ia = list.indexOf(a); const ib = list.indexOf(b);
    list[ia] = b; list[ib] = a;
    for (const [i, m] of list.entries()) {
      if (m.sortOrder !== i) { const r = await actions.updateMetric(m.id, { ...metricToInput(m), sortOrder: i }, 'Order updated'); if (!r.ok) return; }
    }
  };
  const toggleActive = (m: ScorecardMetric) =>
    actions.updateMetric(m.id, { ...metricToInput(m), active: !m.active }, m.active ? 'Metric archived; history kept' : 'Metric restored');

  return (
    <>
      <PageHeader eyebrow={`Weekly scorecard · ${weekLabel(winStart)} to ${weekLabel(winEnd).split(' to ')[1]}`} title="The numbers, every week."
        actions={<>
          <Button variant="outline" className="bg-card" disabled={visible.length === 0}
            onClick={() => downloadCsv(`scorecard-${winStart}-to-${winEnd}.csv`, buildCsv(visible, sc.weeks, sc.entries, staffName))} data-testid="button-export-csv">
            <Download className="mr-1.5 h-4 w-4" />CSV
          </Button>
          {isAdmin && <Button onClick={() => { setEditing(null); setMetricOpen(true); }} className="bg-[#0A2540] text-white" data-testid="button-new-metric"><Plus className="mr-1.5 h-4 w-4" />Metric</Button>}
        </>}>
        Thirteen weeks, Monday to Sunday. Each number has one owner and one goal; green or red is decided by the goal in force when it was recorded.
      </PageHeader>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1.5" data-testid="nav-window">
          <Button variant="outline" size="sm" className="bg-card" onClick={() => go({ week: addWeeks(sc.endWeek, -13) })} data-testid="button-window-older"><ChevronLeft className="mr-1 h-4 w-4" />Older</Button>
          <Button variant="outline" size="sm" className="bg-card" disabled={atToday} onClick={() => go({ week: newer >= today ? null : newer })} data-testid="button-window-newer">Newer<ChevronRight className="ml-1 h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" disabled={atToday} onClick={() => go({ week: null })} className="font-semibold text-[#1D8BC4]" data-testid="button-window-today">Today</Button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_180px_auto] sm:items-center">
          <NativeSelect value={owner} onChange={(e) => go({ owner: e.target.value })} aria-label="Owner" data-testid="filter-scorecard-owner">
            <option value={ALL}>All owners</option>
            {foundation.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </NativeSelect>
          <NativeSelect value={area} onChange={(e) => go({ area: e.target.value })} aria-label="Area" data-testid="filter-scorecard-area">
            <option value={ALL}>All areas</option>
            {foundation.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </NativeSelect>
          <label className="flex items-center gap-2 text-[13px] font-medium text-[#3A4E63]">
            <input type="checkbox" checked={showArchived} onChange={(e) => go({ archived: e.target.checked ? '1' : null })} className="h-4 w-4 accent-[#1D8BC4]" data-testid="toggle-archived" />
            Show archived ({archivedCount})
          </label>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[#3A4E63]" data-testid="legend-scorecard">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#49B949]/30" />On track</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#B03E71]/25" />Off track</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-dashed border-[#0A2540]/25" />No entry or missing</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#1D8BC4]" />Has note</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#ECA519]" />Judged against an earlier goal</span>
      </div>

      {all.length === 0 ? (
        <Panel className="rise flex flex-col items-start gap-4 border-dashed border-[#1D8BC4]/40 bg-[#1D8BC4]/[0.04] py-10">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1D8BC4]">Scorecard</div>
          <p className="font-display text-2xl text-[#0A2540] md:text-3xl" data-testid="text-empty-scorecard">No weekly metrics yet.</p>
          <p className="max-w-lg text-[14px] text-muted-foreground">
            {isAdmin ? 'Most teams settle on five to fifteen numbers: anything you can count weekly, in people, dollars, hours or percent.' : 'An admin sets up the weekly metrics. Once they exist, owners record a number each week.'}
          </p>
          {isAdmin && <Button onClick={() => { setEditing(null); setMetricOpen(true); }} className="bg-[#0A2540] text-white" data-testid="button-empty-new-metric"><Plus className="mr-1.5 h-4 w-4" />Add the first metric</Button>}
        </Panel>
      ) : visible.length === 0 ? (
        <Panel className="border-dashed text-[14px] text-muted-foreground" data-testid="text-scorecard-filtered-empty">No metrics match these filters.</Panel>
      ) : (
        <ScorecardTable metrics={visible} weeks={sc.weeks} entries={sc.entries} foundation={foundation} krLinks={krLinks}
          onCell={(m, w) => setCell({ metricId: m.id, week: w })} onEdit={(m) => { setEditing(m); setMetricOpen(true); }}
          onMove={move} onToggleActive={toggleActive} />
      )}
      <p className="mt-3 text-[12px] text-muted-foreground">Weekly values are context for QBO key results and never change their quarterly progress. Window counts are per metric; different units are never added together.</p>

      {isAdmin && (
        <MetricDialog open={metricOpen} onOpenChange={setMetricOpen} foundation={foundation} krOptions={krOptions} actions={actions} editing={editing}
          nextSort={all.reduce((mx, m) => Math.max(mx, m.sortOrder + 1), 0)} />
      )}
      {cell && cellMetric && (
        <EntryDialog open onOpenChange={(o) => { if (!o) setCell(null); }} metric={cellMetric} weekStart={cell.week} entry={cellEntry}
          revisions={revisionsFor(sc.revisions, cellEntry?.id)} staff={foundation.staff} actions={actions} />
      )}
    </>
  );
}

export default function Scorecard() {
  return <WithFoundation>{(data) => <ScorecardBody foundation={data} />}</WithFoundation>;
}
