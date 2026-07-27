// ── Your test scenarios ────────────────────────────────────────────────────────
// Replace the examples below with your own. Keep each goal to the WHAT, never the HOW
// (no step-by-step directions or specific values) so you measure how people actually navigate.

export interface TestScenario {
  id: string;
  num: number;
  title: string;
  role: string;        // free text, e.g. 'Provider' | 'Admin'
  persona?: string;    // optional — recorded on the session if your app has personas/modes
  goal: string;        // one-line objective shown in the in-task footer
  brief: string;       // fuller context shown before the timer starts (what "done" means)
  start: string;       // hash route your app opens when the task begins, e.g. '#/'
}

export const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'S1', num: 1, title: 'Sign in with the new centralized auth', role: 'Provider',
    goal: 'Sign in to the portal using the new centralized login.',
    brief: 'You need to get into the portal. Sign in using the new centralized authentication. You’re done once you reach the dashboard.',
    start: '#/',
  },
  {
    id: 'S2', num: 2, title: 'Recover access when your login fails', role: 'Provider',
    goal: 'Regain access after an authentication problem.',
    brief: 'Your usual login isn’t working. Get back into the portal using whatever recovery path the product offers. You’re done once you’re signed in.',
    start: '#/',
  },
  // add more…
];

export function getScenario(id: string): TestScenario | undefined {
  return TEST_SCENARIOS.find((s) => s.id === id);
}
