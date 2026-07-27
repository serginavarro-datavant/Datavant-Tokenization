import { useMemo, useRef, useState } from 'react';
import { Text, Badge, Button } from '@datavant/dart';
import {
  IconCheck, IconAlertTriangle, IconPlayerSkipForward, IconUpload,
  IconChevronDown, IconX, IconRoute, IconClock, IconGauge, IconChartBar,
} from '@tabler/icons-react';
import { useTestSession, buildExport, TLX_DIMENSIONS } from './testSession';
import type { ScenarioResult, Outcome, TLX } from './testSession';

// Result files committed to usability-kit/results/*.json are bundled at build time and appear as
// selectable datasets. Drop a downloaded results file in that folder and it shows up here.
const RESULT_FILES = import.meta.glob<{ default: ResultsData }>('./results/*.json', { eager: true });

function fmtDur(ms?: number): string {
  if (!ms && ms !== 0) return '—';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}
function workloadColor(v: number): string {
  if (v <= 33) return '#16a34a';
  if (v <= 66) return '#d97706';
  return '#dc2626';
}
function workloadLabel(v: number): string {
  if (v <= 33) return 'Low';
  if (v <= 66) return 'Moderate';
  return 'High';
}

const OUTCOME_META: Record<Outcome, { label: string; color: string; Icon: typeof IconCheck }> = {
  completed: { label: 'Completed', color: '#16a34a', Icon: IconCheck },
  stuck:     { label: 'Stuck',     color: '#dc2626', Icon: IconAlertTriangle },
  skipped:   { label: 'Skipped',   color: '#94a3b8', Icon: IconPlayerSkipForward },
};

interface ResultsData {
  participant: string;
  summary: { scenariosAttempted: number; completed: number; stuck: number; completionRate: number; avgDurationMs: number; avgTLX: number | null };
  scenarios: ScenarioResult[];
}

const BUNDLED: { key: string; label: string; data: ResultsData }[] = Object.entries(RESULT_FILES)
  .map(([path, mod]) => {
    const data = (mod as { default: ResultsData }).default ?? (mod as unknown as ResultsData);
    const file = path.split('/').pop()!.replace(/\.json$/, '');
    return { key: `file:${path}`, label: data.participant || file, data };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

function aggregate(list: ResultsData[]): ResultsData {
  const scenarios = list.flatMap((d) => d.scenarios ?? []);
  const done = scenarios.filter((s) => s.outcome === 'completed');
  const stuck = scenarios.filter((s) => s.outcome === 'stuck');
  const tlx = scenarios.map((s) => s.tlxRaw).filter((n): n is number => typeof n === 'number');
  return {
    participant: `${list.length} participants`,
    summary: {
      scenariosAttempted: scenarios.length,
      completed: done.length,
      stuck: stuck.length,
      completionRate: scenarios.length ? Math.round((done.length / scenarios.length) * 100) : 0,
      avgDurationMs: done.length ? Math.round(done.reduce((a, s) => a + (s.durationMs ?? 0), 0) / done.length) : 0,
      avgTLX: tlx.length ? Math.round(tlx.reduce((a, b) => a + b, 0) / tlx.length) : null,
    },
    scenarios,
  };
}

function Donut({ pct }: { pct: number }) {
  const R = 46, C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 120 120" className="tr-donut" role="img" aria-label={`${pct}% completed`}>
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--tr-track)" strokeWidth="12" />
      <circle cx="60" cy="60" r={R} fill="none" stroke="#16a34a" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
        transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset 500ms ease' }} />
      <text x="60" y="60" dominantBaseline="central" className="tr-donut-num">{pct}%</text>
    </svg>
  );
}

function radarPoint(cx: number, cy: number, R: number, i: number, n: number, value: number) {
  const ang = -Math.PI / 2 + i * ((Math.PI * 2) / n);
  const r = (R * value) / 100;
  return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)] as const;
}

function TlxRadar({ avg }: { avg: { key: keyof TLX; label: string; value: number }[] }) {
  const size = 260, cx = size / 2, cy = size / 2, R = 88;
  const n = avg.length;
  const rings = [25, 50, 75, 100];
  const poly = (vals: number[]) => vals.map((v, i) => radarPoint(cx, cy, R, i, n, v).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="tr-radar" role="img" aria-label="Average NASA-TLX workload by dimension">
      {rings.map((r) => (<polygon key={r} points={poly(avg.map(() => r))} className="tr-radar-ring" />))}
      {avg.map((d, i) => {
        const [x, y] = radarPoint(cx, cy, R, i, n, 100);
        const [lx, ly] = radarPoint(cx, cy, R + 24, i, n, 100);
        return (
          <g key={d.key}>
            <line x1={cx} y1={cy} x2={x} y2={y} className="tr-radar-axis" />
            <text x={lx} y={ly} className="tr-radar-label"
              textAnchor={lx > cx + 2 ? 'start' : lx < cx - 2 ? 'end' : 'middle'}
              dominantBaseline={ly > cy + 2 ? 'hanging' : ly < cy - 2 ? 'auto' : 'middle'}>
              {d.label.replace(' Demand', '')}
            </text>
          </g>
        );
      })}
      <polygon points={poly(avg.map((d) => d.value))} className="tr-radar-data" />
      {avg.map((d, i) => { const [x, y] = radarPoint(cx, cy, R, i, n, d.value); return <circle key={d.key} cx={x} cy={y} r="3" className="tr-radar-dot" />; })}
    </svg>
  );
}

function TaskRow({ r, maxDur, index }: { r: ScenarioResult; maxDur: number; index: number }) {
  const [open, setOpen] = useState(false);
  const oc = r.outcome ? OUTCOME_META[r.outcome] : null;
  const durPct = maxDur ? Math.max(4, Math.round(((r.durationMs ?? 0) / maxDur) * 100)) : 0;
  const steps = r.path.length;
  const hasDetail = steps > 0 || !!r.tlx || !!r.comment;

  return (
    <div className={`tr-task${open ? ' open' : ''}`}>
      <button className="tr-task-head" onClick={() => hasDetail && setOpen((o) => !o)} type="button" aria-expanded={open}>
        <span className="tr-task-num">{index}</span>
        <span className="tr-task-title">
          <span className="tr-task-name">{r.title}</span>
          <Badge variant="muted" color="neutral" size="sm">{r.role}</Badge>
          {r.attempts > 1 && <span className="tr-task-attempts">{r.attempts} attempts</span>}
        </span>
        {oc && (<span className="tr-chip" style={{ color: oc.color, background: `${oc.color}14` }}><oc.Icon size={12} /> {oc.label}</span>)}
        <span className="tr-task-time">
          <span className="tr-bar"><span className="tr-bar-fill" style={{ width: `${durPct}%` }} /></span>
          <span className="tr-task-time-val">{fmtDur(r.durationMs)}</span>
        </span>
        <span className="tr-task-steps" title="Screens visited">{steps} steps</span>
        {r.tlxRaw != null ? (
          <span className="tr-task-tlx" title={`NASA-TLX workload ${r.tlxRaw}/100`}>
            <span className="tr-dot" style={{ background: workloadColor(r.tlxRaw) }} />{r.tlxRaw}
          </span>
        ) : <span className="tr-task-tlx tr-muted">—</span>}
        {hasDetail && <IconChevronDown size={15} className="tr-task-caret" />}
      </button>

      {open && (
        <div className="tr-task-detail">
          {r.tlx && (
            <div className="tr-detail-block">
              <div className="tr-detail-h">Workload breakdown</div>
              <div className="tr-tlx-bars">
                {TLX_DIMENSIONS.map((d) => {
                  const v = r.tlx![d.key];
                  return (
                    <div key={d.key} className="tr-tlx-bar">
                      <span className="tr-tlx-label">{d.label.replace(' Demand', '')}</span>
                      <span className="tr-bar"><span className="tr-bar-fill" style={{ width: `${v}%`, background: workloadColor(v) }} /></span>
                      <span className="tr-tlx-val">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {steps > 0 && (
            <div className="tr-detail-block">
              <div className="tr-detail-h"><IconRoute size={13} /> Navigation path</div>
              <div className="tr-path">
                {r.path.map((s, i) => (
                  <span key={i} className="tr-path-step">
                    {i > 0 && <span className="tr-path-arrow">→</span>}
                    <span className="tr-path-screen">{s.screen}</span>
                    <span className="tr-path-t">{fmtDur(s.t)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {r.comment && (
            <div className="tr-detail-block">
              <div className="tr-detail-h">Participant note</div>
              <blockquote className="tr-comment">“{r.comment}”</blockquote>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TestResults() {
  useTestSession(); // re-render when the live session changes
  const [imported, setImported] = useState<ResultsData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const live = buildExport() as ResultsData;
  const liveHas = (live.scenarios?.length ?? 0) > 0;

  const datasets: { key: string; label: string; data: ResultsData }[] = [];
  if (liveHas) datasets.push({ key: 'live', label: 'This session', data: live });
  BUNDLED.forEach((b) => datasets.push(b));
  if (BUNDLED.length > 1) datasets.push({ key: 'all', label: `All (${BUNDLED.length})`, data: aggregate(BUNDLED.map((b) => b.data)) });
  if (imported) datasets.push({ key: 'imported', label: `Imported: ${imported.participant || 'file'}`, data: imported });

  const defaultKey = imported ? 'imported' : liveHas ? 'live' : (BUNDLED.length > 1 ? 'all' : BUNDLED[0]?.key ?? null);
  const activeKey = selectedKey && datasets.some((d) => d.key === selectedKey) ? selectedKey : defaultKey;
  const active = datasets.find((d) => d.key === activeKey) ?? null;
  const data: ResultsData = active?.data ?? { participant: '', summary: { scenariosAttempted: 0, completed: 0, stuck: 0, completionRate: 0, avgDurationMs: 0, avgTLX: null }, scenarios: [] };
  const results = data.scenarios ?? [];

  const derived = useMemo(() => {
    const counts: Record<Outcome, number> = { completed: 0, stuck: 0, skipped: 0 };
    results.forEach((r) => { if (r.outcome) counts[r.outcome]++; });
    const withTlx = results.filter((r) => r.tlx);
    const tlxAvg = TLX_DIMENSIONS.map((d) => ({
      key: d.key, label: d.label,
      value: withTlx.length ? Math.round(withTlx.reduce((a, r) => a + r.tlx![d.key], 0) / withTlx.length) : 0,
    }));
    const maxDur = Math.max(0, ...results.map((r) => r.durationMs ?? 0));
    const totalOutcomes = counts.completed + counts.stuck + counts.skipped;
    return { counts, tlxAvg, maxDur, withTlx, totalOutcomes };
  }, [results]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.scenarios)) throw new Error('missing scenarios');
        setImported(parsed as ResultsData);
        setSelectedKey('imported');
        setImportError(null);
      } catch {
        setImportError('That doesn’t look like a results file. Import a JSON exported from this test.');
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  const s = data.summary;
  const avgTLX = s.avgTLX ?? (derived.withTlx.length ? Math.round(derived.withTlx.reduce((a, r) => a + (r.tlxRaw ?? 0), 0) / derived.withTlx.length) : null);

  return (
    <section className="tr-section" aria-label="Results">
      <div className="tr-head">
        <div>
          <h2 className="test-section-h">Results</h2>
          <Text size="sm" c="dimmed">
            {activeKey === 'imported'
              ? <>Imported file{data.participant ? <> — <strong>{data.participant}</strong></> : ''}.</>
              : activeKey === 'live' ? 'Live from this browser session.'
              : activeKey === 'all' ? <>Aggregate across <strong>{BUNDLED.length}</strong> saved result files.</>
              : activeKey ? <>Saved result file{data.participant ? <> — <strong>{data.participant}</strong></> : ''}.</>
              : 'Complete tasks or import a file to populate the charts.'}
          </Text>
        </div>
        <div className="tr-head-actions">
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
          {imported && activeKey === 'imported'
            ? <Button variant="clean" color="neutral" size="sm" leftSection={<IconX size={14} />} onClick={() => { setImported(null); setSelectedKey(null); }}>Clear import</Button>
            : <Button variant="outline" color="neutral" size="sm" leftSection={<IconUpload size={14} />} onClick={() => fileRef.current?.click()}>Import results JSON</Button>}
        </div>
      </div>

      {datasets.length > 1 && (
        <div className="tr-switch" role="tablist" aria-label="Choose results dataset">
          {datasets.map((d) => (
            <button key={d.key} type="button" role="tab" aria-selected={d.key === activeKey}
              className={`tr-switch-chip${d.key === activeKey ? ' active' : ''}`} onClick={() => setSelectedKey(d.key)}>
              {d.label}
            </button>
          ))}
        </div>
      )}

      {importError && <Text size="sm" c="red" mb="sm">{importError}</Text>}

      {results.length === 0 ? (
        <div className="tr-empty">
          <IconChartBar size={26} />
          <Text size="sm" fw={600} mt="xs">No results yet</Text>
          <Text size="sm" c="dimmed">Finish a scenario — or import a returned results file — and the analysis appears here.</Text>
          <Button variant="outline" color="neutral" size="sm" mt="md" leftSection={<IconUpload size={14} />} onClick={() => fileRef.current?.click()}>Import results JSON</Button>
        </div>
      ) : (
        <>
          <div className="tr-kpis">
            <div className="tr-kpi tr-kpi--donut">
              <Donut pct={s.completionRate} />
              <div className="tr-kpi-meta">
                <div className="tr-kpi-label">Completion</div>
                <div className="tr-kpi-sub">{derived.counts.completed} of {derived.totalOutcomes || results.length} tasks</div>
              </div>
            </div>
            <div className="tr-kpi">
              <div className="tr-kpi-icon"><IconClock size={18} /></div>
              <div className="tr-kpi-val">{s.avgDurationMs ? fmtDur(s.avgDurationMs) : '—'}</div>
              <div className="tr-kpi-label">Avg time on task</div>
              <div className="tr-kpi-sub">completed tasks</div>
            </div>
            <div className="tr-kpi">
              <div className="tr-kpi-icon"><IconGauge size={18} /></div>
              <div className="tr-kpi-val" style={{ color: avgTLX != null ? workloadColor(avgTLX) : undefined }}>
                {avgTLX != null ? avgTLX : '—'}<span className="tr-kpi-unit">{avgTLX != null ? '/100' : ''}</span>
              </div>
              <div className="tr-kpi-label">Avg workload</div>
              <div className="tr-kpi-sub">{avgTLX != null ? `${workloadLabel(avgTLX)} · NASA-TLX` : 'no ratings yet'}</div>
            </div>
            <div className={`tr-kpi${derived.counts.stuck > 0 ? ' tr-kpi--warn' : ''}`}>
              <div className="tr-kpi-icon"><IconAlertTriangle size={18} /></div>
              <div className="tr-kpi-val">{derived.counts.stuck}</div>
              <div className="tr-kpi-label">Got stuck</div>
              <div className="tr-kpi-sub">{derived.counts.stuck > 0 ? 'needs attention' : 'none — nice'}</div>
            </div>
          </div>

          <div className="tr-charts">
            <div className="tr-card">
              <div className="tr-card-h">Outcomes</div>
              {derived.totalOutcomes > 0 ? (
                <>
                  <div className="tr-stack" role="img" aria-label="Outcome distribution">
                    {(['completed', 'stuck', 'skipped'] as Outcome[]).map((k) =>
                      derived.counts[k] > 0 ? (
                        <span key={k} className="tr-stack-seg" style={{ flexGrow: derived.counts[k], background: OUTCOME_META[k].color }} title={`${OUTCOME_META[k].label}: ${derived.counts[k]}`} />
                      ) : null)}
                  </div>
                  <div className="tr-legend">
                    {(['completed', 'stuck', 'skipped'] as Outcome[]).map((k) => (
                      <span key={k} className="tr-legend-item"><span className="tr-dot" style={{ background: OUTCOME_META[k].color }} />{OUTCOME_META[k].label} <strong>{derived.counts[k]}</strong></span>
                    ))}
                  </div>
                </>
              ) : <Text size="sm" c="dimmed">No recorded outcomes yet.</Text>}
            </div>
            <div className="tr-card">
              <div className="tr-card-h">Workload profile <span className="tr-card-hint">lower is better</span></div>
              {derived.withTlx.length > 0 ? <div className="tr-radar-wrap"><TlxRadar avg={derived.tlxAvg} /></div> : <Text size="sm" c="dimmed">No NASA-TLX ratings recorded yet.</Text>}
            </div>
          </div>

          <div className="tr-card tr-tasks-card">
            <div className="tr-card-h">By task <span className="tr-card-hint">click a row for path, workload &amp; notes</span></div>
            <div className="tr-tasks">
              {results.map((r, i) => <TaskRow key={r.id} r={r} maxDur={derived.maxDur} index={i + 1} />)}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
