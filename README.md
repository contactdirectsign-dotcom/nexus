# NEXUS

**Your World. Your Gestures. Your Control.**

A personal, free, gesture-controlled app. Black-and-pink interface, built with React, TypeScript, Vite and Tailwind CSS, hosted free on GitHub Pages. No backend, no paid services.

> **Status: Phase 3 (World).** App shell, gesture control with a draggable hand camera, and World: a 3D Earth, city search with local time and weather, world clock, calendar, timer and stopwatch. News (Pulse) is **not built yet** and is labelled as such in the app.

## Put it online for free (no installs needed)

1. Create a free account at <https://github.com>.
2. Create a new repository named `nexus` (**Add a README: off**).
3. On the repository page choose **Add file → Upload files** and drag in everything from the unzipped `nexus` folder, **including the hidden `.github` folder**. (If your phone or file manager hides it, see "Hidden folder" below.) Commit to `main`.
4. Open **Settings → Pages**, and under **Source** choose **GitHub Actions**.
5. Open the **Actions** tab. The "Build, test and deploy" run installs packages, type-checks, runs the tests and builds the app. When it is green, your app is live at `https://YOUR-USERNAME.github.io/nexus/`.
6. If a run fails (red), open it, copy the error text and send it to Claude to fix.

**Hidden folder:** if `.github` will not upload, create the file in GitHub instead: **Add file → Create new file**, type `.github/workflows/ci-deploy.yml` as the name, and paste in the contents of that file from the zip.

## Run it on your own computer (optional)

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev        # development server
npm test           # unit + component tests
npm run typecheck  # TypeScript check
npm run build      # production build into dist/
```

## Project structure

```
src/
  app/          shell: App, TopBar, Nav, ErrorBoundary
  design/       reusable UI (Panel, Button, Badge, EmptyState), icons
  modules/      dashboard, world (globe, clock, timer), calendar, pulse, settings (one folder each)
  gestures/     catalogue + mapping, pose recognizer, swipe/hold tracker, camera engine (MediaPipe)
  modules/setup first-time gesture setup wizard
  storage/      settings store (saved in the browser)
  lib/          time helpers, hash router
  test/         test setup
.github/workflows/ci-deploy.yml   build, test, deploy to GitHub Pages
```

Colours, fonts and glow are defined once in `src/index.css` (`@theme`). Navigation items are defined once in `src/app/navigation.tsx`.

## Privacy

Everything is stored in your own browser. No account, no tracking. The camera is used **only for hand tracking, only after you start it**, and only on your device: video is never recorded, stored or uploaded. A red indicator with Pause and Stop buttons is shown whenever the camera is on, and the camera is released when you leave the tab. The first start downloads the hand-tracking model (a few MB) from public CDNs (jsDelivr and Google Storage).

## Planned architecture decisions

- **News (Phase 4):** a scheduled GitHub Action fetches free RSS feeds and saves a JSON file in the repo; the app reads that file. No API key ever reaches the browser. Feeds' terms and rate limits will be checked per source.
- **Alarms:** browsers cannot reliably ring alarms when closed. The web app will offer an in-app timer and stopwatch; real background alarms would need a native Android app later.
- **Time zones:** the browser's built-in IANA time-zone data, never longitude estimates.

## Dependencies

react, react-dom, framer-motion, @mediapipe/tasks-vision 1.1.1 (runtime); vite, typescript, tailwindcss, vitest, jsdom, React Testing Library (development). three, d3-geo, topojson-client and world-atlas (Phase 3 globe and map data).

## Data sources and credits

- Weather, time zone and city search: [Open-Meteo](https://open-meteo.com/) (free, no key, non-commercial use, CC BY 4.0).
- Country shapes: Natural Earth (public domain) through the `world-atlas` package.

See `FEATURES.md` for the feature and test checklist.
