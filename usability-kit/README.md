# Usability Kit

A drop-in, app-agnostic **usability-test layer** for a React prototype: task scenarios, a
pinned in-task control bar, per-task timing + navigation-path recording, a Raw **NASA-TLX**
workload rating, a JSON export, and a **results dashboard** (KPIs, outcome bar, TLX radar,
per-task path/workload/notes). No backend — everything lives in `localStorage` and exports as one file.

Extracted from the Tokenization Configuration Builder prototype and stripped of all product-specific
code. You wire it to your own prototype in ~15 minutes.

## What's in here

| File | What it is | Do you edit it? |
|------|------------|-----------------|
| `config.ts` | Routes + how the kit navigates | **Yes** (2 min) |
| `scenarios.ts` | Your task scenarios + the `TestScenario` type | **Yes** — write your tasks |
| `testSession.ts` | The recorder store (timing, path, TLX, export) | No |
| `TestHub.tsx` | The landing page: instructions, task list, results | Rarely |
| `TestTaskBar.tsx` | Pinned in-task footer + NASA-TLX finish panel | No |
| `TestResults.tsx` | Results dashboard + results-file loader | No |
| `usability-kit.css` | All styles for the above | No (theme if you like) |
| `results/*.json` | Returned result files (auto-loaded into the dashboard) | Drop files in |

## Requirements

- React 18 or 19
- A bundler with `import.meta.glob` — **Vite** (used for auto-loading `results/*.json`)
- `@datavant/dart` and `@tabler/icons-react` (the UI uses DART components + Tabler icons)

## Integrate (4 steps)

**1. Copy** the `usability-kit/` folder into your app (e.g. `src/usability-kit/`), and import the CSS once (e.g. in your app entry):

```ts
import './usability-kit/usability-kit.css';
```

**2. Edit `config.ts`** — point it at your router and set the routes:

```ts
export const KIT = {
  appName: 'Centralized Auth',
  homeRoute: '#/',          // top-bar back link
  testHubRoute: '#/test',   // where the task bar returns to
  navigate(to) { window.location.hash = to; }, // or your router's navigate
};
```

**3. Mount two things** in your app:

- The **Test Hub** at your `testHubRoute` (a page/route).
- The **Task Bar** once at the app root, so it overlays whatever screen the participant is on. It renders nothing unless a task is running.

```tsx
import TestHub from './usability-kit/TestHub';
import TestTaskBar from './usability-kit/TestTaskBar';

function App() {
  return (
    <>
      {route === '#/test' ? <TestHub /> : <YourApp />}
      <TestTaskBar />
    </>
  );
}
```

**4. Write your tasks in `scenarios.ts`.** Each scenario's `start` is the route your prototype opens
when the task begins. Keep goals to the WHAT, not the HOW.

**Record the navigation path (optional but recommended):** call `logStep('Screen name')` from your
screens (e.g. in a route/tab `useEffect`) so the dashboard can show how people moved:

```ts
import { logStep } from './usability-kit/testSession';
useEffect(() => { logStep('Login'); }, []);
```

## How results flow

1. Participant works through tasks; the kit records time, path, outcome, and a NASA-TLX rating each.
2. They click **Download results** → one JSON file.
3. They send it back. Drop it into `results/` (it appears in the dashboard automatically) **or** use
   the **Import results JSON** button to view a file ad-hoc. With several files, an **All** aggregate appears.

## Notes

- **Storage key:** `localStorage['usability-session-v1']`. `Reset session` clears it.
- **Anonymize** real result files before committing them (see `results/README.md`).
- The kit defines a few CSS variables (`--hb-card`, `--hb-line`, `--tr-track`) scoped to its own roots;
  override them or the hard-coded accent (`#6D28D9`) to match your brand.
- Moderated or unmoderated: for moderated sessions you just run it live while sharing screen; for
  unmoderated, send the link and the in-hub "How this works" guide covers the rest.
