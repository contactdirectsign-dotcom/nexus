import { useEffect, useRef } from 'react';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { clamp, latLonToVec3, normalizeLon, shortestLonDelta, vec3ToLatLon } from '../../../lib/geoMath';
import type { CountryFeature } from './countries';
import { drawEarthTexture } from './earthTexture';

export const GLOBE_MIN_DISTANCE = 1.35;
export const GLOBE_MAX_DISTANCE = 4.5;
export const GLOBE_DEFAULT_VIEW = { lat: 22, lon: 78, distance: 3 }; // starts over South Asia

const FOV = 40;
const MAX_LAT = 85;
const TAP_MAX_PX = 6;
const TAP_MAX_MS = 600;

export interface GlobeMarker {
  id: string;
  lat: number;
  lon: number;
  selected?: boolean;
}

/** What the rest of the app (buttons, keyboard, gestures) can ask the globe to do. */
export interface GlobeController {
  /** Turn the view by degrees: positive dLon looks further east, positive dLat further north. */
  rotateBy(dLon: number, dLat: number): void;
  /** factor > 1 zooms in, < 1 zooms out. */
  zoomBy(factor: number): void;
  reset(): void;
  flyTo(lat: number, lon: number, distance?: number): void;
  center(): { lat: number; lon: number };
  distance(): number;
}

interface Api {
  setMarkers(m: readonly GlobeMarker[]): void;
  setTexture(countries: readonly CountryFeature[], highlight: string | null): void;
}

export function GlobeCanvas({
  countries,
  highlight,
  markers,
  reducedMotion,
  onPick,
  onController,
  onUnsupported,
}: {
  countries: readonly CountryFeature[];
  highlight: string | null;
  markers: readonly GlobeMarker[];
  reducedMotion: boolean;
  onPick: (lat: number, lon: number) => void;
  onController: (c: GlobeController | null) => void;
  onUnsupported: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const latest = useRef({ countries, highlight, markers, reducedMotion, onPick, onController, onUnsupported });
  latest.current = { countries, highlight, markers, reducedMotion, onPick, onController, onUnsupported };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    } catch {
      latest.current.onUnsupported();
      return;
    }
    renderer.setClearColor(0x05020a, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const canvas = renderer.domElement;
    canvas.style.touchAction = 'none';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute(
      'aria-label',
      'Interactive Earth. Drag to turn, pinch or scroll to zoom, tap a place to select it. Arrow keys turn, plus and minus zoom, Enter selects the centre, 0 resets.',
    );
    host.appendChild(canvas);

    const scene = new Scene();
    const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);

    // ---- Earth ----
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 2048;
    textureCanvas.height = 1024;
    drawEarthTexture(textureCanvas, latest.current.countries, latest.current.highlight);
    const texture = new CanvasTexture(textureCanvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const earthGeo = new SphereGeometry(1, 96, 64);
    const earth = new Mesh(earthGeo, new MeshBasicMaterial({ map: texture }));
    scene.add(earth);

    // Soft pink rim glow
    const glowGeo = new SphereGeometry(1.045, 64, 48);
    const glowMat = new MeshBasicMaterial({
      color: 0xff2d95,
      transparent: true,
      opacity: 0.1,
      side: BackSide,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    scene.add(new Mesh(glowGeo, glowMat));

    // A few stars
    const starPositions = new Float32Array(900);
    for (let i = 0; i < 300; i++) {
      const v = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      if (v.lengthSq() < 1e-4) v.set(1, 0, 0);
      v.normalize().multiplyScalar(30);
      starPositions.set([v.x, v.y, v.z], i * 3);
    }
    const starGeo = new BufferGeometry();
    starGeo.setAttribute('position', new BufferAttribute(starPositions, 3));
    const starMat = new PointsMaterial({ color: 0xffffff, size: 0.08, sizeAttenuation: true, transparent: true, opacity: 0.6 });
    scene.add(new Points(starGeo, starMat));

    // ---- Markers ----
    const markerGroup = new Group();
    scene.add(markerGroup);
    const dotGeo = new SphereGeometry(1, 16, 12);
    const ringGeo = new RingGeometry(0.03, 0.04, 40);
    const pinkMat = new MeshBasicMaterial({ color: 0xff2d95 });
    const whiteMat = new MeshBasicMaterial({ color: 0xffffff });
    const ringMat = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide, transparent: true, opacity: 0.9 });

    const setMarkers = (list: readonly GlobeMarker[]): void => {
      markerGroup.clear();
      for (const m of list) {
        const p = latLonToVec3(m.lat, m.lon, 1.004);
        const dot = new Mesh(dotGeo, m.selected ? whiteMat : pinkMat);
        dot.scale.setScalar(m.selected ? 0.02 : 0.013);
        dot.position.set(p.x, p.y, p.z);
        markerGroup.add(dot);
        if (m.selected) {
          const ring = new Mesh(ringGeo, ringMat);
          ring.position.set(p.x, p.y, p.z);
          ring.lookAt(p.x * 2, p.y * 2, p.z * 2);
          markerGroup.add(ring);
        }
      }
      request();
    };

    // ---- View state ----
    const view = { ...GLOBE_DEFAULT_VIEW };
    let velLon = 0; // degrees per second (inertia)
    let velLat = 0;
    let fly: { fromLat: number; fromLon: number; fromD: number; toLat: number; toLon: number; toD: number; t0: number; ms: number } | null = null;
    let raf = 0;
    let lastFrame = 0;
    let disposed = false;

    const applyCamera = (): void => {
      view.lat = clamp(view.lat, -MAX_LAT, MAX_LAT);
      view.lon = normalizeLon(view.lon);
      view.distance = clamp(view.distance, GLOBE_MIN_DISTANCE, GLOBE_MAX_DISTANCE);
      const p = latLonToVec3(view.lat, view.lon, view.distance);
      camera.position.set(p.x, p.y, p.z);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
    };

    const frame = (now: number): void => {
      raf = 0;
      if (disposed) return;
      const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
      lastFrame = now;
      let animating = false;

      if (fly) {
        const k = clamp((now - fly.t0) / fly.ms, 0, 1);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // ease in-out
        view.lat = fly.fromLat + (fly.toLat - fly.fromLat) * e;
        view.lon = fly.fromLon + shortestLonDelta(fly.fromLon, fly.toLon) * e;
        view.distance = fly.fromD + (fly.toD - fly.fromD) * e;
        if (k >= 1) fly = null;
        else animating = true;
      } else if (Math.abs(velLon) > 0.5 || Math.abs(velLat) > 0.5) {
        view.lon += velLon * dt;
        view.lat += velLat * dt;
        const decay = Math.exp(-dt / 0.35);
        velLon *= decay;
        velLat *= decay;
        animating = true;
      } else {
        velLon = 0;
        velLat = 0;
      }

      applyCamera();
      renderer.render(scene, camera);
      if (animating) request();
    };

    function request(): void {
      if (!raf && !disposed) raf = requestAnimationFrame(frame);
    }

    const degreesPerPixel = (): number => {
      const h = Math.max(1, host.clientHeight);
      const rad = ((view.distance - 1) * Math.tan((FOV * Math.PI) / 360) * 2) / h;
      return (rad * 180) / Math.PI;
    };

    const controller: GlobeController = {
      rotateBy(dLon, dLat) {
        fly = null;
        view.lon += dLon;
        view.lat += dLat;
        request();
      },
      zoomBy(factor) {
        fly = null;
        view.distance = clamp(view.distance / factor, GLOBE_MIN_DISTANCE, GLOBE_MAX_DISTANCE);
        request();
      },
      reset() {
        controller.flyTo(GLOBE_DEFAULT_VIEW.lat, GLOBE_DEFAULT_VIEW.lon, GLOBE_DEFAULT_VIEW.distance);
      },
      flyTo(lat, lon, distance) {
        velLon = 0;
        velLat = 0;
        const toD = clamp(distance ?? Math.min(view.distance, 2.2), GLOBE_MIN_DISTANCE, GLOBE_MAX_DISTANCE);
        const toLat = clamp(lat, -MAX_LAT, MAX_LAT);
        if (latest.current.reducedMotion) {
          fly = null;
          view.lat = toLat;
          view.lon = lon;
          view.distance = toD;
        } else {
          fly = { fromLat: view.lat, fromLon: view.lon, fromD: view.distance, toLat, toLon: lon, toD, t0: performance.now(), ms: 900 };
        }
        request();
      },
      center: () => ({ lat: view.lat, lon: view.lon }),
      distance: () => view.distance,
    };

    // ---- Picking ----
    const raycaster = new Raycaster();
    const pick = (clientX: number, clientY: number): void => {
      const r = canvas.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const ndc = new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(earth, false)[0];
      if (!hit) return;
      const { lat, lon } = vec3ToLatLon(hit.point);
      latest.current.onPick(lat, lon);
    };

    // ---- Pointer input: one finger turns, two fingers zoom, a short still tap selects ----
    const pointers = new Map<number, { x: number; y: number }>();
    let tap: { id: number; x: number; y: number; t: number; moved: boolean } | null = null;
    let lastMove = 0;
    let pinchDist = 0;

    const onDown = (e: PointerEvent): void => {
      try {
        canvas.setPointerCapture?.(e.pointerId);
      } catch {
        /* synthetic pointers (air cursor) cannot be captured; they are delivered to the canvas directly */
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      fly = null;
      velLon = 0;
      velLat = 0;
      if (pointers.size === 1) {
        tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
        lastMove = performance.now();
      } else {
        tap = null;
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };

    const onMove = (e: PointerEvent): void => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const next = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, next);

      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0 && d > 0) controller.zoomBy(d / pinchDist);
        pinchDist = d;
        return;
      }
      if (tap && !tap.moved && Math.hypot(next.x - tap.x, next.y - tap.y) > TAP_MAX_PX) tap.moved = true;
      if (tap && !tap.moved) return;
      const k = degreesPerPixel();
      const dLon = -(next.x - prev.x) * k;
      const dLat = (next.y - prev.y) * k;
      view.lon += dLon;
      view.lat += dLat;
      const now = performance.now();
      const secs = Math.max(0.008, (now - lastMove) / 1000);
      lastMove = now;
      // Smoothed release speed for a little inertia
      velLon = velLon * 0.6 + (dLon / secs) * 0.4;
      velLat = velLat * 0.6 + (dLat / secs) * 0.4;
      request();
    };

    const onUp = (e: PointerEvent): void => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (tap && tap.id === e.pointerId) {
        if (!tap.moved && performance.now() - tap.t <= TAP_MAX_MS) pick(e.clientX, e.clientY);
        tap = null;
      }
      pinchDist = 0;
      if (latest.current.reducedMotion || performance.now() - lastMove > 90) {
        velLon = 0;
        velLat = 0;
      }
      request();
    };

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      controller.zoomBy(Math.exp(-e.deltaY * 0.0015));
    };

    const onKey = (e: KeyboardEvent): void => {
      const step = 8;
      let handled = true;
      switch (e.key) {
        case 'ArrowLeft': controller.rotateBy(-step, 0); break;
        case 'ArrowRight': controller.rotateBy(step, 0); break;
        case 'ArrowUp': controller.rotateBy(0, step); break;
        case 'ArrowDown': controller.rotateBy(0, -step); break;
        case '+':
        case '=': controller.zoomBy(1.25); break;
        case '-':
        case '_': controller.zoomBy(0.8); break;
        case '0': controller.reset(); break;
        case 'Enter':
        case ' ': {
          const c = controller.center();
          latest.current.onPick(c.lat, c.lon);
          break;
        }
        default: handled = false;
      }
      if (handled) e.preventDefault();
    };

    const onLost = (e: Event): void => {
      e.preventDefault();
      latest.current.onUnsupported();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('keydown', onKey);
    canvas.addEventListener('webglcontextlost', onLost);

    // ---- Size ----
    const resize = (): void => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      request();
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(host);
    resize();

    apiRef.current = {
      setMarkers,
      setTexture(c, h) {
        drawEarthTexture(textureCanvas, c, h);
        texture.needsUpdate = true;
        request();
      },
    };
    setMarkers(latest.current.markers);
    latest.current.onController(controller);
    applyCamera();
    request();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKey);
      canvas.removeEventListener('webglcontextlost', onLost);
      apiRef.current = null;
      latest.current.onController(null);
      [earthGeo, glowGeo, starGeo, dotGeo, ringGeo, texture, glowMat, starMat, pinkMat, whiteMat, ringMat, earth.material as MeshBasicMaterial].forEach((d) => d.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    apiRef.current?.setMarkers(markers);
  }, [markers]);

  useEffect(() => {
    apiRef.current?.setTexture(countries, highlight);
  }, [countries, highlight]);

  return <div ref={hostRef} className="h-full w-full" />;
}
