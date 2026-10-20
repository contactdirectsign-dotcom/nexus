import { describe, expect, it } from 'vitest';
import { formatCoords, latLonToVec3, normalizeLon, shortestLonDelta, vec3ToLatLon } from './geoMath';

describe('latLonToVec3', () => {
  it('puts Greenwich on the equator at +X and the poles on the Y axis', () => {
    const g = latLonToVec3(0, 0);
    expect(g.x).toBeCloseTo(1);
    expect(g.y).toBeCloseTo(0);
    expect(g.z).toBeCloseTo(0);
    expect(latLonToVec3(90, 0).y).toBeCloseTo(1);
    expect(latLonToVec3(-90, 0).y).toBeCloseTo(-1);
  });

  it('puts 90 E toward -Z and 90 W toward +Z', () => {
    expect(latLonToVec3(0, 90).z).toBeCloseTo(-1);
    expect(latLonToVec3(0, -90).z).toBeCloseTo(1);
  });

  it('respects the radius', () => {
    const v = latLonToVec3(10, 20, 2.5);
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(2.5);
  });
});

describe('vec3ToLatLon', () => {
  it('round-trips real places', () => {
    const places: Array<[number, number]> = [
      [35.69, 139.69], // Tokyo
      [51.5, -0.12], // London
      [-33.87, 151.21], // Sydney
      [40.71, -74.0], // New York
      [-54.8, -68.3], // Ushuaia
      [0, 179.9],
      [0, -179.9],
    ];
    for (const [lat, lon] of places) {
      const back = vec3ToLatLon(latLonToVec3(lat, lon, 3));
      expect(back.lat).toBeCloseTo(lat, 4);
      expect(back.lon).toBeCloseTo(lon, 4);
    }
  });
});

describe('longitude helpers', () => {
  it('normalizes into [-180, 180)', () => {
    expect(normalizeLon(190)).toBeCloseTo(-170);
    expect(normalizeLon(-190)).toBeCloseTo(170);
    expect(normalizeLon(540)).toBeCloseTo(-180);
    expect(normalizeLon(0)).toBe(0);
  });

  it('takes the short way round the globe', () => {
    expect(shortestLonDelta(170, -170)).toBeCloseTo(20);
    expect(shortestLonDelta(-170, 170)).toBeCloseTo(-20);
    expect(shortestLonDelta(10, 40)).toBeCloseTo(30);
  });
});

describe('formatCoords', () => {
  it('uses N/S and E/W', () => {
    expect(formatCoords(35.6895, 139.6917)).toBe('35.69° N, 139.69° E');
    expect(formatCoords(-33.87, -70.5)).toBe('33.87° S, 70.50° W');
  });
});
