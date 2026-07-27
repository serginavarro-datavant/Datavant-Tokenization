# Results

Drop exported results files here (`*.json`) — the ones participants produce via **Download results**.
They load automatically into the **Results** dashboard as selectable datasets (one chip per file,
plus an "All" aggregate when there's more than one).

- Files are bundled at build time (Vite `import.meta.glob`): in dev they hot-reload; for a deployed
  build, add the files then rebuild.
- Anonymize before committing real sessions — set `participant` to a neutral label (e.g. `Test 1`)
  and clear/rename the filename and `userAgent`.
