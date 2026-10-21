import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { useSyncExternalStore } from 'react';
import type { ActionId, GestureSpeed } from './definitions';
import type { Landmarks } from './landmarks';
import { LandmarkSmoother } from './smoothing';
import type { PoseId } from './recognizer';
import {
  GestureTracker,
  IDLE_STATE,
  type GestureEvent,
  type HandFrame,
  type HandPreference,
} from './tracker';

/**
 * GestureEngine owns the camera, the MediaPipe hand model and the frame loop.
 * Privacy: frames are processed on this device only. They are never recorded, stored or uploaded.
 * (Only the model file and the WebAssembly runtime are downloaded, once, from public CDNs.)
 */

// Pinned so the JavaScript package and the WebAssembly files always match.
export const MEDIAPIPE_VERSION = '1.1.1';
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const ACTIVE_INTERVAL_MS = 33; // about 30 frames per second: responsive skeleton and gestures
const PAUSED_INTERVAL_MS = 250;
/**
 * Camera size. The hand model looks at a ~224 px picture anyway, so a small frame costs almost nothing in accuracy
 * and is much cheaper to decode, copy and draw. 4:3 keeps the proportions the gesture maths expect.
 */
const CAMERA_WIDTH = 320;
const CAMERA_HEIGHT = 240;
/** Never run the hand model more often than this, whatever the camera delivers. */
const MIN_FRAME_GAP_MS = 14;
/**
 * The browser needs the main thread for touches and drawing. After each frame, leave at least this share of time
 * idle: gap >= detectMs / (1 - IDLE_SHARE_TARGET) would be exact; this simple form keeps about 35 % free.
 */
const BUSY_SHARE_MAX = 0.65;
const MAX_FRAME_GAP_MS = 120;
/** Below this many frames per second (for this long) the app switches to lighter visuals. */
const SLOW_FPS = 18;
const SLOW_FOR_MS = 2500; // while paused we only watch for the "resume" gesture

export type EngineStatus =
  | 'idle'
  | 'requesting' // waiting for the camera permission prompt
  | 'loading' // downloading / starting the hand model
  | 'running'
  | 'paused'
  | 'suspended' // camera released because the tab is hidden
  | 'error';

export interface EngineSnapshot {
  status: EngineStatus;
  error: string | null;
  handDetected: boolean;
  pose: PoseId;
  confidence: number;
  holdProgress: number;
  userHand: 'left' | 'right' | null;
  detectScore: number;
  /** Hand-tracking frames per second (a low number explains sluggish gestures). */
  fps: number;
  /** Which processor runs the hand model. CPU is much slower than GPU. */
  delegate: 'GPU' | 'CPU' | null;
  /** Milliseconds the hand model needs per frame (average). */
  detectMs: number;
  /** Visual quality tier: 0 full, 1 lighter (no glow/trail), 2 lightest (skeleton only, no live video). Set automatically when the phone is slow. */
  perf: 0 | 1 | 2;
  /** Camera picture size actually delivered, e.g. "320x240". */
  resolution: string;
  lastEvent: GestureEvent | null;
  lastAction: { id: ActionId; t: number } | null;
}

const INITIAL: EngineSnapshot = {
  status: 'idle',
  error: null,
  handDetected: false,
  pose: 'none',
  confidence: 0,
  holdProgress: 0,
  userHand: null,
  detectScore: IDLE_STATE.detectScore,
  fps: 0,
  delegate: null,
  detectMs: 0,
  perf: 0,
  resolution: '',
  lastEvent: null,
  lastAction: null,
};

/** Extra facts about a frame, for things that react to the hand directly (the air cursor). */
export interface FrameMeta {
  t: number;
  pose: PoseId;
  handDetected: boolean;
  /** Index (in `hands`) of the hand that controls NEXUS, or -1. */
  selected: number;
  /** The controlling hand exactly as the camera model reported it (not smoothed), for the air cursor's own filter. */
  raw: Landmarks | null;
  aspect: number;
}

export type FrameListener = (
  hands: readonly Landmarks[],
  size: { width: number; height: number },
  meta: FrameMeta,
) => void;

/** Translate browser camera errors into something a person can act on. */
export function describeCameraError(e: unknown): string {
  const name = e instanceof DOMException || e instanceof Error ? e.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera permission was denied. Allow camera access for this site in your browser settings (the lock icon next to the address), then tap Retry. You can keep using NEXUS with touch controls.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is busy or blocked. Close other apps that use the camera and tap Retry.';
    case 'OverconstrainedError':
      return 'The camera could not provide the requested video settings.';
    case 'SecurityError':
      return 'The browser blocked camera access. Camera needs a secure (https) page.';
    default:
      return 'The camera could not be started. Tap Retry, or continue with touch controls.';
  }
}

interface RawHandResult {
  landmarks: Landmarks[];
  // Newer packages call it `handedness`, older ones `handednesses`.
  handedness?: Array<Array<{ categoryName: string; score: number }>>;
  handednesses?: Array<Array<{ categoryName: string; score: number }>>;
}

class GestureEngine {
  private snap: EngineSnapshot = INITIAL;
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(e: GestureEvent) => void>();
  private frameListeners = new Set<FrameListener>();

  private tracker = new GestureTracker();
  // Separate smoothers for the on-screen skeleton (one per hand slot) so it does not shake.
  private displaySmoothers = [new LandmarkSmoother(4, 40), new LandmarkSmoother(4, 40)];
  private landmarker: HandLandmarker | null = null;
  private loading: Promise<void> | null = null;
  private numHands = 1;

  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private timer: number | null = null;
  private frameCb: number | null = null;
  private lastFrameAt = 0;
  private fpsEma = 0;
  private detectEma = 0;
  private lastProcessAt = 0;
  private slowSince = 0;
  private lastVideoTime = -1;
  private failures = 0;
  /** True while the user wants the camera on (used to resume after the tab was hidden). */
  private wantRunning = false;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
    }
  }

  // ---- store API (for React) ----
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = (): EngineSnapshot => this.snap;

  onEvent(listener: (e: GestureEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  subscribeFrames(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  // ---- configuration ----
  setConfig(cfg: { sensitivity: number; hand: HandPreference; speed: GestureSpeed }): void {
    this.tracker.setConfig({ sensitivity: cfg.sensitivity, hand: cfg.hand, speed: cfg.speed });
    const wanted = cfg.hand === 'either' ? 1 : 2;
    if (wanted !== this.numHands) {
      this.numHands = wanted;
      void this.landmarker?.setOptions({ numHands: wanted });
    }
  }

  // ---- lifecycle ----
  async start(): Promise<void> {
    const s = this.snap.status;
    if (s === 'requesting' || s === 'loading' || s === 'running' || s === 'paused') return;
    this.wantRunning = true;
    this.detectEma = 0;
    this.lastProcessAt = 0;
    this.slowSince = 0;
    this.patch({ status: 'requesting', error: null, perf: 0 });

    try {
      await this.openCamera();
    } catch (e) {
      this.fail(describeCameraError(e));
      return;
    }

    this.patch({ status: 'loading' });
    try {
      await this.ensureLandmarker();
    } catch (e) {
      console.error('Hand model failed to load', e);
      this.releaseCamera();
      this.fail(
        'The hand-tracking model could not be loaded. Check your internet connection (it is downloaded once) and tap Retry.',
      );
      return;
    }

    if (!this.wantRunning) {
      // The user pressed Stop while we were loading.
      this.releaseCamera();
      this.patch({ status: 'idle' });
      return;
    }
    this.tracker.reset();
    this.failures = 0;
    this.patch({ status: 'running' });
    this.schedule(0);
  }

  stop(): void {
    this.wantRunning = false;
    this.clearTimer();
    this.releaseCamera();
    this.tracker.reset();
    this.patch({ ...this.trackerFields(), status: 'idle', error: null });
  }

  setPaused(paused: boolean): void {
    const s = this.snap.status;
    if (paused && s === 'running') this.patch({ status: 'paused' });
    else if (!paused && s === 'paused') {
      this.tracker.reset();
      this.patch({ status: 'running' });
    }
  }

  /** Remember which action the last gesture triggered (shown in the on-screen indicator). */
  reportAction(id: ActionId): void {
    this.patch({ lastAction: { id, t: Date.now() } });
  }

  // ---- internals ----
  private async openCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new DOMException('Camera API unavailable', 'SecurityError');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: CAMERA_WIDTH }, height: { ideal: CAMERA_HEIGHT }, frameRate: { ideal: 60 } },
      audio: false,
    });
    this.stream = stream;
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener('ended', this.onTrackEnded);
    });

    if (!this.video) {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.setAttribute('aria-hidden', 'true');
      // Kept in the page but invisible: some browsers do not decode video that is display:none.
      v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
      document.body.appendChild(v);
      this.video = v;
    }
    this.video.srcObject = stream;
    await this.video.play();
    if (this.video.videoWidth > 0 && this.video.videoHeight > 0) {
      this.tracker.setConfig({ aspect: this.video.videoWidth / this.video.videoHeight });
      this.patch({ resolution: `${this.video.videoWidth}x${this.video.videoHeight}` });
    }
  }

  private releaseCamera(): void {
    this.stream?.getTracks().forEach((track) => {
      track.removeEventListener('ended', this.onTrackEnded);
      track.stop();
    });
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.lastVideoTime = -1;
  }

  private onTrackEnded = (): void => {
    this.wantRunning = false;
    this.clearTimer();
    this.releaseCamera();
    this.tracker.reset();
    this.fail('The camera was disconnected. Reconnect it and tap Retry.');
  };

  private onVisibility = (): void => {
    const s = this.snap.status;
    if (document.hidden) {
      if (s === 'running' || s === 'paused') {
        // Release the camera while NEXUS is in the background (privacy and battery).
        this.clearTimer();
        this.releaseCamera();
        this.tracker.reset();
        this.patch({ ...this.trackerFields(), status: 'suspended' });
      }
    } else if (s === 'suspended' && this.wantRunning) {
      void this.resumeAfterSuspend();
    }
  };

  private async resumeAfterSuspend(): Promise<void> {
    try {
      await this.openCamera();
      this.patch({ status: 'running' });
      this.schedule(0);
    } catch (e) {
      this.fail(describeCameraError(e));
    }
  }

  private ensureLandmarker(): Promise<void> {
    if (this.landmarker) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
      const create = (delegate: 'GPU' | 'CPU') =>
        vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: 'VIDEO',
          numHands: this.numHands,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      try {
        this.landmarker = await create('GPU');
        this.patch({ delegate: 'GPU' });
      } catch {
        this.landmarker = await create('CPU');
        this.patch({ delegate: 'CPU' });
      }
    })().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private schedule(delay: number): void {
    this.clearTimer();
    const v = this.video;
    // Wake up exactly when the camera delivers a new frame (lowest delay). A short timer stays as a safety net.
    if (delay > 0 && delay <= ACTIVE_INTERVAL_MS && v && typeof v.requestVideoFrameCallback === 'function') {
      this.frameCb = v.requestVideoFrameCallback(() => {
        this.frameCb = null;
        this.tick();
      });
      this.timer = window.setTimeout(this.tick, 150);
    } else {
      this.timer = window.setTimeout(this.tick, delay);
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.frameCb !== null) {
      this.video?.cancelVideoFrameCallback?.(this.frameCb);
      this.frameCb = null;
    }
  }

  private tick = (): void => {
    this.clearTimer();
    const status = this.snap.status;
    if (status !== 'running' && status !== 'paused') return;
    const video = this.video;
    const landmarker = this.landmarker;

    if (video && landmarker && video.readyState >= 2 && video.currentTime !== this.lastVideoTime) {
      // Governor: leave the browser enough idle time. A slow hand model must never starve touches and drawing.
      const sinceLast = performance.now() - this.lastProcessAt;
      const gap =
        status === 'paused'
          ? 0
          : Math.min(MAX_FRAME_GAP_MS, Math.max(MIN_FRAME_GAP_MS, this.detectEma / BUSY_SHARE_MAX));
      if (sinceLast < gap) {
        this.schedule(ACTIVE_INTERVAL_MS); // not yet: wait for a later camera frame (the frame is not consumed)
        return;
      }
      this.lastVideoTime = video.currentTime;
      try {
        const now = performance.now();
        const result = landmarker.detectForVideo(video, now) as unknown as RawHandResult;
        const took = performance.now() - now;
        this.detectEma = this.detectEma === 0 ? took : this.detectEma * 0.85 + took * 0.15;
        this.lastProcessAt = now;
        const sides = result.handedness ?? result.handednesses ?? [];
        const hands: HandFrame[] = result.landmarks.map((landmarks, i) => {
          const category = sides[i]?.[0];
          const label = category?.categoryName === 'Left' || category?.categoryName === 'Right' ? category.categoryName : undefined;
          return { landmarks, label, score: category?.score ?? 0 };
        });

        if (this.lastFrameAt > 0) {
          const inst = 1000 / Math.max(1, now - this.lastFrameAt);
          this.fpsEma = this.fpsEma === 0 ? inst : this.fpsEma * 0.9 + inst * 0.1;
        }
        this.lastFrameAt = now;
        this.failures = 0;

        const events = this.tracker.update(now, hands);
        if (hands.length === 0) this.displaySmoothers.forEach((d) => d.reset());
        const display = hands.slice(0, 2).map((h, i) => this.displaySmoothers[i].apply(now, h.landmarks));
        const tracked = this.tracker.getState();
        const sel = this.tracker.pickIndex(hands);
        const meta: FrameMeta = {
          t: now,
          pose: tracked.pose,
          handDetected: tracked.handDetected,
          selected: sel,
          raw: sel >= 0 ? hands[sel].landmarks : null,
          aspect: video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 4 / 3,
        };
        // A bug in a screen's frame listener must never stop hand tracking, so each one is isolated.
        for (const l of this.frameListeners) {
          try {
            l(display, { width: video.videoWidth, height: video.videoHeight }, meta);
          } catch (err) {
            console.error('Frame listener failed', err);
          }
        }
        this.governQuality(now);
        this.patch({
          ...this.trackerFields(),
          fps: Math.round(this.fpsEma),
          detectMs: Math.round(this.detectEma),
          resolution: `${video.videoWidth}x${video.videoHeight}`,
        });
        for (const e of events) {
          this.patch({ lastEvent: e });
          for (const l of this.eventListeners) {
            try {
              l(e);
            } catch (err) {
              console.error('Gesture listener failed', err);
            }
          }
        }
      } catch (e) {
        this.failures += 1;
        console.error('Hand tracking frame failed', e);
        if (this.failures >= 5) {
          this.clearTimer();
          this.releaseCamera();
          this.wantRunning = false;
          this.fail('Hand tracking stopped unexpectedly. Tap Retry.');
          return;
        }
      }
    }
    this.schedule(this.snap.status === 'paused' ? PAUSED_INTERVAL_MS : ACTIVE_INTERVAL_MS);
  };

  /** If the phone stays slow, step the visuals down (never the tracking itself) until it keeps up. */
  private governQuality(now: number): void {
    const slow = this.fpsEma > 0 && this.fpsEma < SLOW_FPS;
    if (!slow) {
      this.slowSince = 0;
      return;
    }
    if (this.slowSince === 0) this.slowSince = now;
    if (now - this.slowSince > SLOW_FOR_MS && this.snap.perf < 2) {
      this.slowSince = now;
      this.fpsEma = 0; // measure again at the new tier
      this.patch({ perf: (this.snap.perf + 1) as 1 | 2 });
    }
  }

  private trackerFields(): Pick<
    EngineSnapshot,
    'handDetected' | 'pose' | 'confidence' | 'holdProgress' | 'userHand' | 'detectScore'
  > {
    const s = this.tracker.getState();
    return {
      handDetected: s.handDetected,
      pose: s.pose,
      // Coarse steps on purpose: every change re-renders the screen, and camera frames arrive 30-60 times a second.
      confidence: Math.round(s.confidence * 10) / 10,
      holdProgress: Math.round(s.holdProgress * 10) / 10,
      userHand: s.userHand,
      detectScore: Math.round(s.detectScore * 10) / 10,
    };
  }

  private fail(message: string): void {
    this.clearTimer();
    this.patch({ ...this.trackerFields(), status: 'error', error: message });
  }

  /** Update the snapshot, and notify React only if something actually changed. */
  private patch(change: Partial<EngineSnapshot>): void {
    const next = { ...this.snap, ...change };
    const keys = Object.keys(next) as Array<keyof EngineSnapshot>;
    if (keys.every((k) => next[k] === this.snap[k])) return;
    this.snap = next;
    this.listeners.forEach((l) => l());
  }
}

export const engine = new GestureEngine();

export function useEngine(): EngineSnapshot {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
}
