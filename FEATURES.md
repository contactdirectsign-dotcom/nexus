# NEXUS feature and test checklist

Legend: [x] built, [ ] not built. "Verified" says what was actually checked.

## Phase 1: Foundation

- [x] React + TypeScript + Vite + Tailwind project
- [x] Black-and-pink design tokens, glass panels, buttons, badges, empty states
- [x] Responsive shell: sidebar on desktop, bottom tab bar on phones
- [x] Hash routing (works on GitHub Pages), lazy-loaded modules
- [x] Top bar: branding, live clock, date, gesture status, settings button
- [x] Dashboard with honest empty states (no fake news, no fake globe)
- [x] Settings: time format, reduced effects, preferred hand, sensitivity, gesture assignments, reset, erase data
- [x] Gesture catalogue + reusable gesture-to-action mapping (data only, no camera yet)
- [x] Error boundary, reduced-motion support, focus outlines, aria labels
- [x] CI/deploy workflow for GitHub Pages

## Not built yet

- [ ] Phase 2: camera permission flow, MediaPipe hand tracking, setup wizard, calibration, gesture testing, pause/resume
- [ ] Phase 3: 3D Earth, city search, location info, world clock, calendar, timer, stopwatch
- [ ] Phase 4: Pulse news (RSS via GitHub Action), categories, ranking, duplicate detection
- [ ] Phase 5: integration (globe selection -> news search, gesture navigation between modules)
- [ ] Phase 6: future modules (Intelligence, Device, Vault, Space, Studio)
- [ ] Phase 7: browser (Playwright), mobile, performance and security testing

## Verification status for Phase 1 (honest record)

| Check | Status |
| --- | --- |
| Pure-logic tests (gestures, settings store, time/routing): 22 tests | **Passed** (run with Bun and a localStorage shim, not Vitest) |
| Whole app bundles without syntax or import errors (esbuild) | **Passed** |
| `tsc` type check | **Not run** (npm registry was blocked) |
| Vitest component tests (`App.test.tsx`) | **Not run** |
| `vite build` / Tailwind styling / framer-motion | **Not run** |
| Visual check in a browser, on an Android phone | **Not done** |

These run for the first time on GitHub when you upload the project.

## Known issues / limits

- Layout and visuals have never been viewed in a browser; expect small spacing or contrast fixes.
- Fonts load from Google Fonts; the app falls back to system fonts if blocked.
- No `package-lock.json` yet; GitHub generates versions on each build (it will be committed after the first good run).

## Next step

Upload to GitHub, make the first build green, then start Phase 2 (Gesture Lab).
