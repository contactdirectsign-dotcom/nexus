// Geographic math for the globe. Plain numbers only (no three.js) so it can be unit-tested.
//
// Convention (matches three.js SphereGeometry with an equirectangular texture):
//   longitude 0 (Greenwich) faces +X, longitude 90 E faces -Z, north pole is +Y.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const DEG = Math.PI / 180;

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Wrap a longitude into [-180, 180). */
export function normalizeLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Signed shortest turn from one longitude to another, in degrees (-180..180]. */
export function shortestLonDelta(from: number, to: number): number {
  const d = normalizeLon(to - from);
  return d === -180 ? 180 : d;
}

export function latLonToVec3(lat: number, lon: number, radius = 1): Vec3 {
  const phi = ((lon + 180) / 360) * 2 * Math.PI;
  const theta = (90 - lat) * DEG;
  return {
    x: -radius * Math.cos(phi) * Math.sin(theta),
    y: radius * Math.cos(theta),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

export function vec3ToLatLon(v: Vec3): { lat: number; lon: number } {
  const r = Math.hypot(v.x, v.y, v.z) || 1;
  const lat = 90 - Math.acos(clamp(v.y / r, -1, 1)) / DEG;
  let phi = Math.atan2(v.z, -v.x); // -pi..pi
  if (phi < 0) phi += 2 * Math.PI;
  const lon = phi / DEG - 180;
  return { lat, lon: normalizeLon(lon) };
}

/** Human-readable coordinates, e.g. "35.69° N, 139.69° E". */
export function formatCoords(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
}
