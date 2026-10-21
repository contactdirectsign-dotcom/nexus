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
- [x] **Air cursor** (on by default, switch in Settings): the cursor appears on the first camera frame the index finger is up (judged per frame from the raw hand, not from the slower gesture classifier; fist and open palm never show it); it moves over the whole app with a short glowing trail, a ring that fills as you close a pinch, lock-on highlight, click ripple and scroll arrows; light look-ahead hides camera delay on fast moves without overshooting; pinch thumb+index to click, keep pinching and move to drag (sliders, globe, drawing, camera window); two fingers up/down to scroll, or to zoom the globe. Only the middle of the camera frame maps to the screen; the cursor freezes at the aimed spot while a pinch closes so you click what you aimed at; whatever is under the cursor is highlighted; short vibration on click where the phone supports it
- [x] Gesture Lab (nav item): Air Draw (neon pen, 5 colours, 3 sizes, undo, clear, save PNG; works by touch, mouse or air pinch-drag) and a 30-second Target practice game with a saved best score
- [x] Timer gestures: swipe up/down adds or removes a minute, select starts/pauses, back resets
- [x] Gesture speed setting (Calm / Balanced / Quick / Instant, default Quick; Quick fires a fist in about 0.2 s) scaling hold times, cooldowns and the pause between actions; adaptive dwell (clear, confident poses fire sooner); a fixed 600 ms swipe lock so one swipe is never two
- [x] Fewer re-renders (confidence/score reported in coarse steps) and 60 fps camera request, so the screen is not redrawn on every frame
- [x] Low-lag tracking: One Euro filter (still hand steady, fast hand followed almost instantly), frames processed the moment the camera delivers them (requestVideoFrameCallback), live fps and GPU/CPU readout in the hand camera so slowness can be diagnosed
- [x] Hand camera window (top right): live skeleton with per-finger colours, glow and filled palm; drag it anywhere by touch (position remembered), tap to resize, double-tap the grip bar to return to the corner, hide in Settings
- [x] Touch fallback everywhere (nothing requires gestures)
- [ ] Custom recorded gesture templates (deliberately not built: a few examples cannot train a reliable recogniser; built-in landmark gestures only)
- [ ] Two-hand gestures such as two-handed globe zoom (the air cursor uses one hand)
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
| Air cursor logic (instant appearance, fist/palm hidden, mapping, steadiness, no overshoot, pinch freeze, click, drag, scroll, mode switching): 19 tests; Lab logic: 5 tests | **Passed** (Bun, here) |
| Air cursor on a real hand and screen (aim, click accuracy, drag, scroll feel; how pinch behaves with your fingers) | **Not tested.** Thresholds are first guesses from synthetic hands |
| Real camera + MediaPipe on a phone (recognition accuracy, thresholds, left/right label) | **Not tested.** Thresholds were tuned on synthetic hands only and will need adjusting with real use |

## Known limitations

- Gesture accuracy depends on light, camera angle and distance (about an arm's length, palm toward the camera). Expect to tune sensitivity.
- MediaPipe's model and runtime are downloaded once from public CDNs (jsDelivr, Google Storage) the first time the camera starts, so the first start needs internet.
- Left/right hand detection assumes MediaPipe's documented mirrored-label behaviour; if it reports the wrong side on your phone, tell Claude.
- Gestures only control app-wide navigation/scroll for now. Screen-specific actions (cards in Pulse, globe zoom) arrive with those modules.

## Next step

Apply the Phase 3 update (`npm install` is needed for the new packages), check the globe on a phone, then Phase 4 (Pulse news).

## Phase 3.4: speed and cursor accuracy (untested on a real phone)
- Hand tracking runs on a small 320x240 camera picture and a frame governor: if the hand model is slow, frames are skipped so touches and drawing keep working. If the phone stays under 18 fps, visuals get lighter automatically.
- The air cursor appears for any detected hand in a pointing pose, also when the main gesture recogniser says "pointing". A half-curled middle finger still counts as pointing.
- Magnetic targets: the cursor counts as on a button when it is within about 22 px of it, so small buttons are easier to hit.
- Settings → "Show tracking details" adds a line to the hand window (model time, camera size, quality tier, finger readings). The version is shown in the same setting's hint.

## Phase 3.5: steadier clicks
- The aim now freezes earlier: as soon as the thumb and index start moving together (or close quickly), the cursor locks to where the fingertip was about 0.2 s before, so the finger drifting during a pinch no longer shifts the click.

## Phase 3.6: clicks and drags rebuilt
- The aim point now follows the smoothed palm while you pinch, so flexing or opening your fingers no longer moves it.
- Dragging uses a smoothed palm (it used raw landmarks before, which jittered).
- Releasing needs two frames of open fingers and lets go at the last steady spot; a single noisy frame no longer drops the drag.
- A camera frame with no hand during a pinch is ignored for 0.3 s. The click move allowance is 22 px.

## Phase 3.7: lighter, cleaner cursor
- Cursor redrawn: a small dot with a thin ring (fills while pinching, grows over buttons, shrinks while pressed). The trail, drop-shadow filter and per-frame glow changes are gone; only one transform changes per frame.
