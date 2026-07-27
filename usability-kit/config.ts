// ── Wire the kit to your app here ──────────────────────────────────────────────
// This is the ONLY app-specific file. Point `navigate` at your router and set the routes.
export const KIT = {
  // Shown in the test-hub top bar as "← {appName}", linking to homeRoute.
  appName: 'Prototype',
  homeRoute: '#/',        // where the top-bar back link goes
  testHubRoute: '#/test', // where TestTaskBar returns when a task ends / is exited

  // How your app navigates. Default is hash-based; swap in your router's navigate if you have one.
  navigate(to: string) {
    if (typeof window !== 'undefined') window.location.hash = to;
  },
};
