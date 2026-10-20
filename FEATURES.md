# NEXUS feature and test checklist

Legend: [x] built, [ ] not built. "Verified" says what was actually checked.

## Phase 1: Foundation (live, verified on GitHub)

- [x] React + TypeScript + Vite + Tailwind project, black-and-pink design system
- [x] Responsive shell (sidebar / bottom tabs), hash routing, lazy-loaded modules
- [x] Top bar (branding, clock, date, gesture status, settings), dashboard with honest empty states
- [x] Settings framework (time format, reduced effects, reset, erase data)
- [x] Error boundary, reduced-motion support, focus outlines, aria labels
- [x] CI/deploy to GitHub Pages

## Phase 2: Gesture Lab

- [x] Camera permission flow with explanations and useful error messages (denied, no camera, busy, insecure page, disconnected)
- [x] MediaPipe Hand Landmarker (pinned 1.1.1), GPU with CPU fallback, runs on-device
- [x] First-time setup wizard, 7 stages: welcome, camera, hand choice, calibration (live skeleton preview), gesture assignment, practice, finish. Repeatable from Settings
- [x] Built-in gestures: open palm, closed fist, pointing, two fingers, pinch, swipe left/right/up/down, pinch-and-release
- [x] Reusable gesture-to-action mapping (8 actions), changeable any time in Settings
- [x] Safety rules: short dwell time for poses (fist 0.5 s, pinch 0.25 s, open palm 0.75 s at medium sensitivity), fires once then must release, 450 ms cooldown, 2-frame debounce, swipes from movement only, "return" motion after a swipe ignored, hand-lost handling, sensitivity slider
- [x] Pause/resume (low-power watching for the pause gesture only), Stop, always-visible red camera indicator, on-screen gesture readout
- [x] Camera released when the tab is hidden and when stopped; auto-restart only if the browser already remembers permission
- [x] Gesture speed setting (Calm / Balanced / Quick / Instant, default Quick) scaling hold times, cooldowns and the pause between actions; adaptive dwell (clear, confident poses fire sooner); a fixed 600 ms swipe lock so one swipe is never two
- [x] Low-lag tracking: One Euro filter (still hand steady, fast hand followed almost instantly), frames processed the moment the camera delivers them (requestVideoFrameCallback), live fps and GPU/CPU readout in the hand camera so slowness can be diagnosed
- [x] Hand camera window (top right): live skeleton with per-finger colours, glow and filled palm; drag it anywhere by touch (position remembered), tap to resize, double-tap the grip bar to return to the corner, hide in Settings
- [x] Touch fallback everywhere (nothing requires gestures)
- [ ] Custom recorded gesture templates (deliberately not built: a few examples cannot train a reliable recogniser; built-in landmark gestures only)
- [ ] True two-hand gestures ("Both hands" currently means either hand can control)

## Phase 3: World (written, awaiting first real build)

- [x] 3D Earth (Three.js): real country shapes from Natural Earth drawn in black and pink, drag to turn with inertia, pinch/scroll zoom, tap to select, selected-country highlight, markers for saved cities, keyboard control, on-screen buttons, fly-to animation (instant with reduced effects)
- [x] Country picker and place search work without 3D (used automatically when WebGL is unavailable)
- [x] City search (Open-Meteo geocoding, free, no key) with loading, empty and offline-error states
- [x] Selected-place panel: local time, date, UTC offset and difference from you, weather, wind, day/night, sunrise/sunset, honest error with retry, Open-Meteo credit
- [x] World clock: up to 12 saved cities, correct IANA time zones and daylight saving (Intl, no longitude guessing), day/night icon
- [x] Calendar: month, week and day views, add/edit/delete events with validation, upcoming list, saved in IndexedDB (memory fallback with a visible warning)
- [x] Timer and stopwatch (timestamp-based, survive refresh, laps, beep + vibrate when the timer ends while the app is open)
- [x] Gesture actions on the Globe tab (turn, tilt, zoom, select centre, back) and Calendar tab (next/previous period)
- [x] "Search news here" hands the chosen place to Pulse (shown there; real news search comes in Phase 4/5)
- [x] "Erase all local data" also clears favourites, calendar and timers
- [ ] Alarms that ring when the app is closed (not possible in a web page; would need a native app)
- [ ] City-level or sub-national borders (the free map data is country-level only)

## Not built yet

- [ ] Phase 4: Pulse news (RSS via GitHub Action), categories, ranking, duplicate detection, per-screen gesture navigation of cards
- [ ] Phase 5: integration (globe selection -> news search)
- [ ] Phase 6: future modules (Intelligence, Device, Vault, Space, Studio)
- [ ] Phase 7: browser (Playwright), performance and security testing

## Verification status (honest record)

| Check | Status |
| --- | --- |
| Phase 1 on GitHub: type check, tests, build, deploy | **Passed** |
| Gesture logic (poses, swipes, holds, cooldowns, pinch tap, hand preference): 34 tests on synthetic hands | **Passed** (Bun, here) |
| Settings / routing / time logic tests | **Passed** (Bun, here) |
| App bundles without syntax or import errors | **Passed** (esbuild, here) |
| Phase 2 `tsc` type check, Vitest component tests, `vite build` | **Not yet run** (first run is in Codespaces / GitHub) |
| Hand-camera drag/resize and new skeleton drawing | **Bundles; not yet seen on a real phone** |
| Phase 3 pure logic (geo math, time zones, dates, events, timers, favourites, API parsing) | **Passed** (Bun, here; 3 `vi.stubGlobal` tests only run under Vitest) |
| Phase 3 strict type check of logic files | **Passed** (tsc, here). UI files **not** type-checked here (packages not installable) |
| Phase 3 UI bundles | **Passed** (esbuild/Bun, here) |
| Phase 3 `npm install`, `tsc`, Vitest component tests, `vite build`, real globe on a phone | **Not yet run** (first run is in Codespaces / GitHub) |
| Open-Meteo response format | Written from memory of the public docs; parsers are defensive, not verified against a live call |
| Gesture speed, One Euro smoothing, frame-synced loop (tracker/smoother/settings tests, strict tsc of gesture logic) | **Passed** (here). Real-phone feel **not tested** |
| Real camera + MediaPipe on a phone (recognition accuracy, thresholds, left/right label) | **Not tested.** Thresholds were tuned on synthetic hands only and will need adjusting with real use |

## Known limitations

- Gesture accuracy depends on light, camera angle and distance (about an arm's length, palm toward the camera). Expect to tune sensitivity.
- MediaPipe's model and runtime are downloaded once from public CDNs (jsDelivr, Google Storage) the first time the camera starts, so the first start needs internet.
- Left/right hand detection assumes MediaPipe's documented mirrored-label behaviour; if it reports the wrong side on your phone, tell Claude.
- Gestures only control app-wide navigation/scroll for now. Screen-specific actions (cards in Pulse, globe zoom) arrive with those modules.

## Next step

Apply the Phase 3 update (`npm install` is needed for the new packages), check the globe on a phone, then Phase 4 (Pulse news).
