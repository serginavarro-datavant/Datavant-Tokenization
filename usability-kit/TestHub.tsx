import { useState } from 'react';
import { Button, Text, TextInput, Badge, Modal } from '@datavant/dart';
import { IconDownload, IconRefresh, IconCheck, IconAlertTriangle, IconPlayerPlay, IconArrowLeft } from '@tabler/icons-react';
import { KIT } from './config';
import { TEST_SCENARIOS } from './scenarios';
import type { TestScenario } from './scenarios';
import { useTestSession, startScenario, setParticipant, resetSession, downloadResults, buildExport } from './testSession';
import TestResults from './TestResults';

function fmtDur(ms?: number): string {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function TestHub() {
  const session = useTestSession();
  const summary = buildExport().summary;
  const [briefing, setBriefing] = useState<TestScenario | null>(null);

  // Timing starts only when the participant leaves the briefing and enters the task.
  function beginTask(sc: TestScenario) {
    setBriefing(null);
    startScenario(sc);
    KIT.navigate(sc.start);
  }

  return (
    <div className="test-page">
      <div className="test-topbar">
        <a onClick={() => KIT.navigate(KIT.homeRoute)}><IconArrowLeft size={14} /> {KIT.appName}</a>
        <span className="test-where">Usability test</span>
      </div>

      <div className="test-wrap">
        <h1 className="test-h1">Usability test</h1>
        <p className="test-lead">
          Thanks for helping test this. It takes about 15 minutes, and you can do it whenever suits you.
          There are no right answers.
        </p>

        <ol className="test-how" aria-label="How this works">
          <li><span className="test-how-n">1</span><div><strong>Start a task.</strong> Pick any task below and click <em>Start</em>. You’ll see a short brief, then click <em>Start task</em> to begin.</div></li>
          <li><span className="test-how-n">2</span><div><strong>Do it your way.</strong> There’s no set path, so explore as you naturally would. A timer runs in the background, so no need to rush.</div></li>
          <li><span className="test-how-n">3</span><div><strong>Wrap up.</strong> Use the bar at the bottom: <em>I finished this task</em>, or <em>I’m stuck</em> if you can’t. Both are useful.</div></li>
          <li><span className="test-how-n">4</span><div><strong>Rate it.</strong> Drag the sliders to say how the task felt, add a note if anything was confusing, then <em>Submit &amp; next</em>.</div></li>
          <li><span className="test-how-n">5</span><div><strong>Send results.</strong> When all tasks are done, click <em>Download results</em> and send the file back. Results stay in this browser, so download before you close the tab.</div></li>
        </ol>

        <div className="test-session-row">
          <TextInput
            label="Your name or alias (optional)"
            placeholder="e.g. P03 or Alex"
            value={session.participant}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParticipant(e.currentTarget.value)}
            size="sm"
            style={{ maxWidth: 260 }}
          />
          <div className="test-session-actions">
            <Button variant="outline" color="neutral" size="sm" leftSection={<IconDownload size={14} />} onClick={downloadResults}>Download results</Button>
            <Button variant="clean" color="neutral" size="sm" leftSection={<IconRefresh size={14} />}
              onClick={() => { if (confirm('Reset this session and clear all recorded results?')) resetSession(); }}>Reset session</Button>
          </div>
        </div>

        <div className="test-progress">
          <div className="test-progress-bar"><div className="test-progress-fill" style={{ width: `${(summary.completed / TEST_SCENARIOS.length) * 100}%` }} /></div>
          <Text size="sm" c="dimmed">
            {summary.completed}/{TEST_SCENARIOS.length} completed
            {summary.stuck > 0 && ` · ${summary.stuck} stuck`}
            {summary.avgTLX != null && ` · avg workload ${summary.avgTLX}/100`}
          </Text>
        </div>

        <div className="test-list">
          {TEST_SCENARIOS.map((sc) => {
            const r = session.scenarios[sc.id];
            const status = r?.outcome;
            return (
              <div key={sc.id} className={`test-card${status === 'completed' ? ' done' : status === 'stuck' ? ' stuck' : ''}`}>
                <div className="test-card-num">{sc.num}</div>
                <div className="test-card-body">
                  <div className="test-card-head">
                    <h3 className="test-card-title">{sc.title}</h3>
                    <Badge variant="muted" color="neutral" size="sm">{sc.role}</Badge>
                    {status === 'completed' && <span className="test-status done"><IconCheck size={13} /> Completed · {fmtDur(r?.durationMs)}{r?.tlxRaw != null ? ` · TLX ${r.tlxRaw}` : ''}</span>}
                    {status === 'stuck' && <span className="test-status stuck"><IconAlertTriangle size={13} /> Stuck · {fmtDur(r?.durationMs)}</span>}
                  </div>
                  <Text size="sm" c="dimmed" className="test-card-goal">{sc.goal}</Text>
                </div>
                <Button variant={status ? 'outline' : 'filled'} color={status ? 'neutral' : 'primary'} size="sm"
                  leftSection={<IconPlayerPlay size={13} />} onClick={() => setBriefing(sc)}>
                  {status ? 'Redo' : 'Start'}
                </Button>
              </div>
            );
          })}
        </div>

        <TestResults />

        <div className="test-finish-note">
          <Text size="sm">Done with all the scenarios? <strong>Download results</strong> above and send the JSON file back. Thank you!</Text>
        </div>
      </div>

      {/* Pre-task briefing — explains what to accomplish before the timer starts. */}
      <Modal opened={!!briefing} onClose={() => setBriefing(null)} title={briefing ? `Scenario ${briefing.num} of ${TEST_SCENARIOS.length}` : ''} size={560}>
        {briefing && (
          <div className="test-brief">
            <div className="test-brief-head">
              <h2 className="test-brief-title">{briefing.title}</h2>
              <Badge variant="muted" color="neutral" size="sm">{briefing.role}</Badge>
            </div>
            <Text size="sm" className="test-brief-body">{briefing.brief}</Text>
            <div className="test-brief-tip">
              <Text size="sm"><strong>Do it however you would naturally.</strong> There’s no set path, and thinking aloud helps. The timer starts when you begin. Use the bar at the bottom when you finish or if you get stuck.</Text>
            </div>
            <div className="test-brief-actions">
              <Button variant="outline" color="neutral" size="sm" onClick={() => setBriefing(null)}>Cancel</Button>
              <Button color="primary" size="sm" leftSection={<IconPlayerPlay size={13} />} onClick={() => beginTask(briefing)}>Start task</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
