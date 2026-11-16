import { useMemo, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import type { Foundation, ScorecardMetric } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { WithFoundation } from '@/components/with-foundation';
import { ErrorPanel, PageHeader, PageSkeleton, Panel } from '@/components/ui-bits';
import { NativeSelect } from '@/components/native-select';
import { TrackerMetricForm, type KrOption } from '@/components/scorecard/tracker-metric-form';
import { TrackerRow, type KrLink } from '@/components/scorecard/tracker-row';
import { MetricDetail } from '@/components/scorecard/metric-detail';
import { useStaffSession } from '@/lib/session-context';
import { useOkrWorkspace } from '@/lib/okr';
import { useMasterCalendar } from '@/lib/calendar-hooks';
import { isQbo } from '@/lib/qbo';
import { bySortTitle, downloadCsv } from '@/lib/scorecard';
import { fetchAllTrend, trendAllKey, useTracker, useTrackerActions } from '@/lib/scorecard-tracker-hooks';
import { buildMeasurementCsv, dayLabel, latestFor, milestonesFor, structuralPayload } from '@/lib/scorecard-tracker';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/format';
import type { ScorecardMeasurement } from '@workspace/api-client-react';

const ALL = 'all';

function ScorecardBody({ foundation }: { foundation: Foundation }) {
  const me = useStaffSession();
  const isAdmin = me.role === 'admin';
  const search = useSearch();
  const [, setLocation] = useLocation();
  const sp = new URLSearchParams(search);
  const owner = sp.get('owner') ?? ALL;
  const area = sp.get('area') ?? ALL;
  const showArchived = sp.get('archived') === '1';
  const openId = sp.get('metric');

  const q = useTracker();
  const okr = useOkrWorkspace();
  const cal = useMasterCalendar();
  const actions = useTrackerActions();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScorecardMetric | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

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
  const events = cal.data?.events ?? [];

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const t = q.data;
  const all = [...t.metrics].sort(bySortTitle);
  const visible = all.filter((m) => (showArchived || m.active) && (owner === ALL || m.ownerId === owner) && (area === ALL || m.areaId === area));
  const archivedCount = all.filter((m) => !m.active).length;
  const opened = openId ? all.find((m) => m.id === openId) : undefined;
  const editingMs = editing ? milestonesFor(t.milestones, editing.id) : [];
  const hasData = editing ? t.latest.some((e) => e.metricId === editing.id) : false;

  const move = async (index: number, dir: -1 | 1) => {
    const a = visible[index]; const b = visible[index + dir];
    if (!a || !b) return;
    if (a.sortOrder !== b.sortOrder) {
      const r = await actions.updateMetric(a.id, structuralPayload(a, { sortOrder: b.sortOrder }), 'Order updated', true);
      if (r.ok) await actions.updateMetric(b.id, structuralPayload(b, { sortOrder: a.sortOrder }), 'Order updated');
      return;
    }
    const list = [...all]; const ia = list.indexOf(a); const ib = list.indexOf(b);
    list[ia] = b; list[ib] = a;
    for (const [i, m] of list.entries()) {
      if (m.sortOrder !== i) { const r = await actions.updateMetric(m.id, structuralPayload(m, { sortOrder: i }), 'Order updated', true); if (!r.ok) return; }
    }
  };
  const toggleActive = (m: ScorecardMetric) =>
    actions.updateMetric(m.id, structuralPayload(m, { active: !m.active }), m.active ? 'Metric archived; history kept' : 'Metric restored');

  const exportCsv = async () => {
    const byMetric: Record<string, ScorecardMeasurement[]> = {};
    try {
      for (const [i, m] of visible.entries()) {
        setExporting(`${i + 1}/${visible.length}`);
        byMetric[m.id] = await qc.fetchQuery({ queryKey: trendAllKey(m.id), queryFn: () => fetchAllTrend(m.id), staleTime: 10_000 });
      }
      downloadCsv(`scorecard-measurements-${t.today}.csv`, buildMeasurementCsv(visible, byMetric, foundation.staff));
    } catch (e) {
      toast({ title: 'Export stopped', description: `Full history could not load (${errorMessage(e)}). No partial file was saved; try again.`, variant: 'destructive' });
    } finally { setExporting(null); }
  };

  return (
    <>
      <PageHeader eyebrow={`Scorecard · as of ${dayLabel(t.today)}`} title="The numbers that matter, as they move."
        actions={<>
          <Button variant="outline" className="bg-card" disabled={visible.length === 0 || !!exporting} onClick={exportCsv} data-testid="button-export-csv">
            <Download className="mr-1.5 h-4 w-4" />{exporting ? `Exporting ${exporting}` : 'CSV'}
          </Button>
          {isAdmin && <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-[#0A2540] text-white" data-testid="button-new-metric"><Plus className="mr-1.5 h-4 w-4" />Metric</Button>}
        </>}>
        Record a value whenever it changes. Every save is kept; open a metric to see its whole history against the targets in force.
      </PageHeader>

      <div className="mb-3 inline-flex rounded-lg border border-border bg-muted/50 p-1" role="group" aria-label="Scorecard quick filters">
        {[{ label: 'My Scorecards', value: me.id, id: 'my' }, { label: 'All Scorecards', value: ALL, id: 'all' }].map(choice => (
          <button key={choice.id} type="button" aria-pressed={owner === choice.value}
            onClick={() => go({ owner: choice.value })}
            data-testid={`button-scorecards-${choice.id}`}
            className={`rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${owner === choice.value ? 'bg-[#0A2540] text-white shadow-sm' : 'text-[#3A4E63] hover:bg-card'}`}>
            {choice.label}
          </button>
        ))}
      </div>
      <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-[200px_200px_auto] sm:items-center">
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

      {all.length === 0 ? (
        <Panel className="rise flex flex-col items-start gap-4 border-dashed border-[#1D8BC4]/40 bg-[#1D8BC4]/[0.04] py-10">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1D8BC4]">Scorecard</div>
          <p className="font-display text-2xl text-[#0A2540] md:text-3xl" data-testid="text-empty-scorecard">No metrics yet.</p>
          <p className="max-w-lg text-[14px] text-muted-foreground">
            {isAdmin ? 'Start with the numbers staff already chase: event registrations, volunteer applications, dollars raised. Link one to a calendar event and set dated targets.' : 'An admin sets up the metrics. Once they exist, owners record the latest value here.'}
          </p>
          {isAdmin && <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-[#0A2540] text-white" data-testid="button-empty-new-metric"><Plus className="mr-1.5 h-4 w-4" />Add the first metric</Button>}
        </Panel>
      ) : visible.length === 0 ? (
        <Panel className="border-dashed text-[14px] text-muted-foreground" data-testid="text-scorecard-filtered-empty">No metrics match these filters.</Panel>
      ) : (
        <div className="space-y-2.5" data-testid="list-metrics">
          {visible.map((m, i) => (
            <TrackerRow key={m.id} metric={m} milestones={milestonesFor(t.milestones, m.id)} latest={latestFor(t.latest, m.id)} today={t.today}
              foundation={foundation} event={m.calendarEventId ? events.find((e) => e.id === m.calendarEventId) : undefined}
              krLink={m.linkedKeyResultId ? krLinks[m.linkedKeyResultId] : undefined} isAdmin={isAdmin}
              canUp={i > 0} canDown={i < visible.length - 1} actions={actions}
              onOpen={() => go({ metric: m.id })} onEdit={() => { setEditing(m); setFormOpen(true); }}
              onMove={(dir) => void move(i, dir)} onToggleActive={() => void toggleActive(m)} />
          ))}
        </div>
      )}
      <p className="mt-3 text-[12px] text-muted-foreground">Values are context for QBO key results and never change their progress. Dated targets count only from their due date; different units are never added together.</p>

      {isAdmin && (
        <TrackerMetricForm open={formOpen} onOpenChange={setFormOpen} foundation={foundation} krOptions={krOptions} events={events} actions={actions}
          editing={editing} milestones={editingMs} hasData={hasData} nextSort={all.reduce((mx, m) => Math.max(mx, m.sortOrder + 1), 0)} />
      )}
      {opened && (
        <MetricDetail key={opened.id} metric={opened} milestones={milestonesFor(t.milestones, opened.id)} today={t.today} foundation={foundation}
          event={opened.calendarEventId ? events.find((e) => e.id === opened.calendarEventId) : undefined} actions={actions} onClose={() => go({ metric: null })} />
      )}
    </>
  );
}

export default function Scorecard() {
  return <WithFoundation>{(data) => <ScorecardBody foundation={data} />}</WithFoundation>;
}
