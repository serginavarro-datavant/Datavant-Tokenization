import { useSyncExternalStore } from 'react';
import type { TestScenario } from './scenarios';

// ── Unmoderated / moderated usability-test recorder ─────────────────────────────
// Records per-scenario timing, navigation path, outcome, and a Raw NASA-TLX workload rating.
// Everything is kept in localStorage (survives refresh) and exports as one JSON. No backend.
// App-agnostic: it knows nothing about your product — you drive it via startScenario / logStep /
// endScenario and describe tasks in scenarios.ts.

export type Outcome = 'completed' | 'stuck' | 'skipped';

// Raw NASA-TLX subscales (0–100). Performance is anchored Good(0)→Poor(100) so higher = worse,
// consistent with the other five — the raw score is the simple average of all six.
export interface TLX {
  mental: number;
  physical: number;
  temporal: number;
  performance: number;
  effort: number;
  frustration: number;
}

export interface StepEvent { t: number; screen: string; }

export interface ScenarioResult {
  id: string;
  title: string;
  role: string;
  outcome?: Outcome;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  attempts: number;
  path: StepEvent[];
  tlx?: TLX;
  tlxRaw?: number;
  comment?: string;
}

interface ActiveState { id: string; startMs: number; persona?: string; }

export interface Session {
  sessionId: string;
  participant: string;
  startedAt: string;
  userAgent: string;
  scenarios: Record<string, ScenarioResult>;
  active: ActiveState | null;
}

const KEY = 'usability-session-v1';

function freshSession(): Session {
  return {
    sessionId: `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    participant: '',
    startedAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    scenarios: {},
    active: null,
  };
}

function load(): Session {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Session;
  } catch { /* ignore */ }
  return freshSession();
}

let session: Session = load();
const listeners = new Set<() => void>();

function commit(next: Session) {
  session = next;
  try { localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function getSnapshot() { return session; }

export function useTestSession(): Session {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Non-hook accessor for imperative call sites (e.g. path logging in your screens).
export function currentSession() { return session; }

export const TLX_DIMENSIONS: { key: keyof TLX; label: string; question: string; low: string; high: string }[] = [
  { key: 'mental', label: 'Mental Demand', question: 'How mentally demanding was the task?', low: 'Very low', high: 'Very high' },
  { key: 'physical', label: 'Physical Demand', question: 'How physically demanding was the task?', low: 'Very low', high: 'Very high' },
  { key: 'temporal', label: 'Temporal Demand', question: 'How hurried or rushed was the pace?', low: 'Very low', high: 'Very high' },
  { key: 'performance', label: 'Performance', question: 'How successful were you in accomplishing it?', low: 'Perfect', high: 'Failure' },
  { key: 'effort', label: 'Effort', question: 'How hard did you have to work?', low: 'Very low', high: 'Very high' },
  { key: 'frustration', label: 'Frustration', question: 'How insecure, stressed or annoyed were you?', low: 'Very low', high: 'Very high' },
];

export function rawTLX(t: TLX): number {
  const vals = TLX_DIMENSIONS.map((d) => t[d.key]);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// ── Mutations ───────────────────────────────────────────────────────────────
export function setParticipant(name: string) {
  commit({ ...session, participant: name });
}

export function startScenario(sc: TestScenario) {
  const prev = session.scenarios[sc.id];
  const result: ScenarioResult = {
    id: sc.id, title: sc.title, role: sc.role,
    startedAt: new Date().toISOString(),
    attempts: (prev?.attempts ?? 0) + 1,
    path: [],
  };
  commit({
    ...session,
    scenarios: { ...session.scenarios, [sc.id]: result },
    active: { id: sc.id, startMs: Date.now(), persona: sc.persona },
  });
}

// Call this from your screens (e.g. in a route/tab effect) to record the navigation path.
export function logStep(screen: string) {
  const a = session.active;
  if (!a) return;
  const sc = session.scenarios[a.id];
  if (!sc) return;
  const last = sc.path[sc.path.length - 1];
  if (last && last.screen === screen) return; // dedupe consecutive
  const path = [...sc.path, { t: Date.now() - a.startMs, screen }];
  commit({ ...session, scenarios: { ...session.scenarios, [a.id]: { ...sc, path } } });
}

export function endScenario(outcome: Outcome, tlx?: TLX, comment?: string) {
  const a = session.active;
  if (!a) return;
  const sc = session.scenarios[a.id];
  if (!sc) return;
  const updated: ScenarioResult = {
    ...sc, outcome, endedAt: new Date().toISOString(),
    durationMs: Date.now() - a.startMs,
    tlx, tlxRaw: tlx ? rawTLX(tlx) : undefined,
    comment: comment?.trim() || undefined,
  };
  commit({ ...session, scenarios: { ...session.scenarios, [a.id]: updated }, active: null });
}

/** Leave the active scenario without recording an outcome (returns to the hub, still resumable). */
export function abandonScenario() {
  if (!session.active) return;
  commit({ ...session, active: null });
}

export function resetSession() { commit(freshSession()); }

// ── Export ────────────────────────────────────────────────────────────────
export function buildExport() {
  const results = Object.values(session.scenarios);
  const done = results.filter((r) => r.outcome === 'completed');
  const stuck = results.filter((r) => r.outcome === 'stuck');
  const tlxScores = results.map((r) => r.tlxRaw).filter((n): n is number => typeof n === 'number');
  return {
    sessionId: session.sessionId,
    participant: session.participant || 'anonymous',
    startedAt: session.startedAt,
    exportedAt: new Date().toISOString(),
    userAgent: session.userAgent,
    summary: {
      scenariosAttempted: results.length,
      completed: done.length,
      stuck: stuck.length,
      completionRate: results.length ? Math.round((done.length / results.length) * 100) : 0,
      avgDurationMs: done.length ? Math.round(done.reduce((a, r) => a + (r.durationMs ?? 0), 0) / done.length) : 0,
      avgTLX: tlxScores.length ? Math.round(tlxScores.reduce((a, b) => a + b, 0) / tlxScores.length) : null,
    },
    scenarios: results,
  };
}

export function downloadResults() {
  const data = buildExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `usability-${data.participant.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
