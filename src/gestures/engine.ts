import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { useSyncExternalStore } from 'react';
import type { ActionId } from './definitions';
import type { Landmarks } from './landmarks';
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

const ACTIVE_INTERVAL_MS = 55; // about 18 frames per second: plenty for gestures, gentle on batteries
const PAUSED_INTERVAL_MS = 250; // while paused we only watch for the "resume" gesture

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
  lastEvent: null,
  lastAction: null,
};

export type FrameListener = (hands: readonly Landmarks[], size: { width: number; height: number }) => void;

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
  private landmarker: HandLandmarker | null = null;
  private loading: Promise<void> | null = null;
  private numHands = 1;

  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private timer: number | null = null;
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
  setConfig(cfg: { sensitivity: number; hand: HandPreference }): void {
    this.tracker.setConfig({ sensitivity: cfg.sensitivity, hand: cfg.hand });
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
    this.patch({ status: 'requesting', error: null });

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
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
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
      } catch {
        this.landmarker = await create('CPU');
      }
    })().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private schedule(delay: number): void {
    this.clearTimer();
    this.timer = window.setTimeout(this.tick, delay);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private tick = (): void => {
    const status = this.snap.status;
    if (status !== 'running' && status !== 'paused') return;
    const video = this.video;
    const landmarker = this.landmarker;

    if (video && landmarker && video.readyState >= 2 && video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      try {
        const now = performance.now();
        const result = landmarker.detectForVideo(video, now) as unknown as RawHandResult;
        const sides = result.handedness ?? result.handednesses ?? [];
        const hands: HandFrame[] = result.landmarks.map((landmarks, i) => {
          const category = sides[i]?.[0];
          const label = category?.categoryName === 'Left' || category?.categoryName === 'Right' ? category.categoryName : undefined;
          return { landmarks, label, score: category?.score ?? 0 };
        });

        const events = this.tracker.update(now, hands);
        this.failures = 0;
        this.frameListeners.forEach((l) =>
          l(
            hands.map((h) => h.landmarks),
            { width: video.videoWidth, height: video.videoHeight },
          ),
        );
        this.patch(this.trackerFields());
        for (const e of events) {
          this.patch({ lastEvent: e });
          this.eventListeners.forEach((l) => l(e));
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

  private trackerFields(): Pick<
    EngineSnapshot,
    'handDetected' | 'pose' | 'confidence' | 'holdProgress' | 'userHand' | 'detectScore'
  > {
    const s = this.tracker.getState();
    return {
      handDetected: s.handDetected,
      pose: s.pose,
      confidence: Math.round(s.confidence * 100) / 100,
      holdProgress: Math.round(s.holdProgress * 10) / 10,
      userHand: s.userHand,
      detectScore: Math.round(s.detectScore * 100) / 100,
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
