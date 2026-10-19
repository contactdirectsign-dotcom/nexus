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
- [x] Safety rules: dwell time for poses, fires once then must release, 700 ms cooldown, 2-frame debounce, swipes from movement only, "return" motion after a swipe ignored, hand-lost handling, sensitivity slider
- [x] Pause/resume (low-power watching for the pause gesture only), Stop, always-visible red camera indicator, on-screen gesture readout
- [x] Camera released when the tab is hidden and when stopped; auto-restart only if the browser already remembers permission
- [x] Touch fallback everywhere (nothing requires gestures)
- [ ] Custom recorded gesture templates (deliberately not built: a few examples cannot train a reliable recogniser; built-in landmark gestures only)
- [ ] True two-hand gestures ("Both hands" currently means either hand can control)

## Not built yet

- [ ] Phase 3: 3D Earth, city search, location info, world clock, calendar, timer, stopwatch
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
| Real camera + MediaPipe on a phone (recognition accuracy, thresholds, left/right label) | **Not tested.** Thresholds were tuned on synthetic hands only and will need adjusting with real use |

## Known limitations

- Gesture accuracy depends on light, camera angle and distance (about an arm's length, palm toward the camera). Expect to tune sensitivity.
- MediaPipe's model and runtime are downloaded once from public CDNs (jsDelivr, Google Storage) the first time the camera starts, so the first start needs internet.
- Left/right hand detection assumes MediaPipe's documented mirrored-label behaviour; if it reports the wrong side on your phone, tell Claude.
- Gestures only control app-wide navigation/scroll for now. Screen-specific actions (cards in Pulse, globe zoom) arrive with those modules.

## Next step

Run the Phase 2 update, test on a real phone, report what feels wrong, then Phase 3 (World).
