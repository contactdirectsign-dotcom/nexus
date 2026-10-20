import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPlaceInfo, parseForecast, parseGeocode, searchPlaces, weatherText } from './placeApi';

describe('parseGeocode', () => {
  it('maps Open-Meteo results', () => {
    const results = parseGeocode({
      results: [
        {
          id: 1850147,
          name: 'Tokyo',
          latitude: 35.6895,
          longitude: 139.69171,
          country: 'Japan',
          country_code: 'JP',
          admin1: 'Tokyo',
          timezone: 'Asia/Tokyo',
          population: 8336599,
        },
      ],
    });
    expect(results).toEqual([
      {
        id: 'geo:1850147',
        name: 'Tokyo',
        country: 'Japan',
        countryCode: 'JP',
        admin: 'Tokyo',
        lat: 35.6895,
        lon: 139.69171,
        timezone: 'Asia/Tokyo',
        population: 8336599,
      },
    ]);
  });

  it('returns nothing for empty, missing or malformed data', () => {
    expect(parseGeocode({})).toEqual([]);
    expect(parseGeocode(null)).toEqual([]);
    expect(parseGeocode({ results: 'x' })).toEqual([]);
    expect(parseGeocode({ results: [{ name: 'No coords' }, 5, null] })).toEqual([]);
  });
});

describe('parseForecast', () => {
  it('reads time zone, weather and sun times', () => {
    const info = parseForecast({
      timezone: 'Asia/Tokyo',
      timezone_abbreviation: 'JST',
      utc_offset_seconds: 32400,
      current: { temperature_2m: 18.4, weather_code: 3, wind_speed_10m: 9.1, is_day: 1 },
      daily: { sunrise: ['2026-10-19T05:40'], sunset: ['2026-10-19T16:55'] },
    });
    expect(info).toEqual({
      timezone: 'Asia/Tokyo',
      tzAbbr: 'JST',
      utcOffsetSeconds: 32400,
      temperatureC: 18.4,
      windKmh: 9.1,
      weather: 'Overcast',
      isDay: true,
      sunrise: '05:40',
      sunset: '16:55',
    });
  });

  it('copes with missing parts (polar day) and rejects answers without a zone', () => {
    const info = parseForecast({ timezone: 'Arctic/Longyearbyen', daily: { sunrise: [null], sunset: [] } });
    expect(info?.timezone).toBe('Arctic/Longyearbyen');
    expect(info?.sunrise).toBeUndefined();
    expect(info?.temperatureC).toBeUndefined();
    expect(parseForecast({})).toBeNull();
    expect(parseForecast(7)).toBeNull();
  });
});

describe('weatherText', () => {
  it('describes common codes', () => {
    expect(weatherText(0)).toBe('Clear sky');
    expect(weatherText(63)).toBe('Rain');
    expect(weatherText(95)).toBe('Thunderstorm');
    expect(weatherText(1234)).toBe('Unknown conditions');
  });
});

describe('network helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not call the network for very short queries', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await searchPlaces('a')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds the geocoding request and parses the answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ name: 'Paris', latitude: 48.85, longitude: 2.35, timezone: 'Europe/Paris' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const r = await searchPlaces('Paris & co');
    expect(String(fetchMock.mock.calls[0][0])).toContain('name=Paris%20%26%20co');
    expect(r[0].timezone).toBe('Europe/Paris');
  });

  it('throws a clear error when the service fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(searchPlaces('London')).rejects.toThrow(/500/);
    await expect(fetchPlaceInfo(1.11, 2.22)).rejects.toThrow(/500/);
  });
});
