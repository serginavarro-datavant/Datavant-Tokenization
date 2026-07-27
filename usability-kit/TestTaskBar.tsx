import { useEffect, useState } from 'react';
import { Button, Text } from '@datavant/dart';
import { IconCheck, IconAlertTriangle, IconX } from '@tabler/icons-react';
import { KIT } from './config';
import { getScenario, TEST_SCENARIOS } from './scenarios';
import { useTestSession, endScenario, abandonScenario, TLX_DIMENSIONS } from './testSession';
import type { TLX, Outcome } from './testSession';

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const DEFAULT_TLX: TLX = { mental: 50, physical: 20, temporal: 50, performance: 50, effort: 50, frustration: 50 };

// Pinned footer shown WHILE a scenario is running. States only the objective (the WHAT) — no steps.
// Mount this once at the app root so it appears over whatever screen the participant is on.
export default function TestTaskBar() {
  const session = useTestSession();
  const active = session.active;
  const scenario = active ? getScenario(active.id) : undefined;

  const [finishing, setFinishing] = useState<Outcome | null>(null);
  const [tlx, setTlx] = useState<TLX>(DEFAULT_TLX);
  const [comment, setComment] = useState('');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) return;
    const tick = () => setElapsed(Date.now() - active.startMs);
    tick();
    const iv = window.setInterval(tick, 1000);
    return () => window.clearInterval(iv);
  }, [active]);

  if (!active || !scenario) return null;

  function beginFinish(outcome: Outcome) { setFinishing(outcome); }
  function submit() {
    endScenario(finishing ?? 'completed', tlx, comment);
    KIT.navigate(KIT.testHubRoute);
  }
  function exit() { abandonScenario(); KIT.navigate(KIT.testHubRoute); }

  return (
    <div className="tt-bar">
      {/* TLX finish panel */}
      {finishing && (
        <div className="tt-finish">
          <div className="tt-finish-head">
            <span className={`tt-outcome tt-outcome--${finishing}`}>
              {finishing === 'completed' ? <><IconCheck size={14} /> Task completed</> : <><IconAlertTriangle size={14} /> Marked as stuck</>}
            </span>
            <Text size="sm" c="dimmed">Quick workload check (NASA-TLX). Drag each to answer, then submit.</Text>
          </div>
          <div className="tt-tlx">
            {TLX_DIMENSIONS.map((d) => (
              <label key={d.key} className="tt-tlx-row">
                <span className="tt-tlx-label">{d.label}<span className="tt-tlx-q">{d.question}</span></span>
                <span className="tt-tlx-slider">
                  <span className="tt-tlx-anchor">{d.low}</span>
                  <input
                    type="range" min={0} max={100} step={5} value={tlx[d.key]}
                    onChange={(e) => { const v = Number(e.currentTarget.value); setTlx((p) => ({ ...p, [d.key]: v })); }}
                  />
                  <span className="tt-tlx-anchor">{d.high}</span>
                  <span className="tt-tlx-val">{tlx[d.key]}</span>
                </span>
              </label>
            ))}
          </div>
          <textarea
            className="tt-comment"
            placeholder="Anything confusing or blocking? (optional)"
            value={comment}
            onChange={(e) => setComment(e.currentTarget.value)}
          />
          <div className="tt-finish-actions">
            <Button variant="clean" color="neutral" size="sm" onClick={() => setFinishing(null)}>Back to task</Button>
            <Button color="primary" size="sm" onClick={submit}>Submit &amp; next</Button>
          </div>
        </div>
      )}

      {/* Control row — objective only, no directions */}
      <div className="tt-row">
        <span className="tt-tag">Task {scenario.num}/{TEST_SCENARIOS.length}</span>
        <span className="tt-goal-line"><strong className="tt-title">{scenario.title}.</strong> {scenario.goal}</span>
        <span className="tt-timer">{fmt(elapsed)}</span>
        {!finishing && (
          <span className="tt-actions">
            <button className="tt-exit" type="button" onClick={exit} title="Leave without recording"><IconX size={14} /> Exit</button>
            <Button variant="outline" color="neutral" size="sm" leftSection={<IconAlertTriangle size={13} />} onClick={() => beginFinish('stuck')}>I’m stuck</Button>
            <Button color="primary" size="sm" leftSection={<IconCheck size={13} />} onClick={() => beginFinish('completed')}>I finished this task</Button>
          </span>
        )}
      </div>
    </div>
  );
}
