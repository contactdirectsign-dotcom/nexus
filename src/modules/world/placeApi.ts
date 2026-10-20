// Place search, time zone and weather from Open-Meteo (https://open-meteo.com).
// Free, no API key, and it allows browser requests. Free use is for non-commercial projects with a
// daily request limit, and it must be credited ("Weather data by Open-Meteo.com", CC BY 4.0).
// Nothing is invented: if the service cannot be reached the callers show an honest message.

export interface PlaceResult {
  id: string;
  name: string;
  country?: string;
  countryCode?: string;
  admin?: string;
  lat: number;
  lon: number;
  /** IANA time zone, e.g. "Asia/Tokyo". */
  timezone?: string;
  population?: number;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Turn the geocoding response into clean results. Anything malformed is skipped. */
export function parseGeocode(json: unknown): PlaceResult[] {
  if (!isObj(json) || !Array.isArray(json.results)) return [];
  const out: PlaceResult[] = [];
  for (const r of json.results) {
    if (!isObj(r)) continue;
    const name = str(r.name);
    const lat = num(r.latitude);
    const lon = num(r.longitude);
    if (!name || lat === undefined || lon === undefined) continue;
    out.push({
      id: `geo:${num(r.id) ?? `${lat.toFixed(3)},${lon.toFixed(3)}`}`,
      name,
      country: str(r.country),
      countryCode: str(r.country_code),
      admin: str(r.admin1),
      lat,
      lon,
      timezone: str(r.timezone),
      population: num(r.population),
    });
  }
  return out;
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  return parseGeocode(await res.json());
}

export interface PlaceInfo {
  timezone: string;
  tzAbbr?: string;
  utcOffsetSeconds?: number;
  temperatureC?: number;
  windKmh?: number;
  weather?: string;
  isDay?: boolean;
  /** Local "HH:mm" at that place, today. Missing in polar day/night. */
  sunrise?: string;
  sunset?: string;
}

/** WMO weather interpretation codes used by Open-Meteo. */
export function weatherText(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code === 85 || code === 86) return 'Snow showers';
  if (code === 95) return 'Thunderstorm';
  if (code === 96 || code === 99) return 'Thunderstorm with hail';
  return 'Unknown conditions';
}

function timePart(v: unknown): string | undefined {
  const s = str(v);
  const t = s?.split('T')[1];
  return t && /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : undefined;
}

/** Parse the forecast response. Returns null when there is no usable time zone. */
export function parseForecast(json: unknown): PlaceInfo | null {
  if (!isObj(json)) return null;
  const timezone = str(json.timezone);
  if (!timezone) return null;
  const current = isObj(json.current) ? json.current : {};
  const daily = isObj(json.daily) ? json.daily : {};
  const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : undefined);
  const code = num(current.weather_code);
  const isDay = num(current.is_day);
  return {
    timezone,
    tzAbbr: str(json.timezone_abbreviation),
    utcOffsetSeconds: num(json.utc_offset_seconds),
    temperatureC: num(current.temperature_2m),
    windKmh: num(current.wind_speed_10m),
    weather: code === undefined ? undefined : weatherText(code),
    isDay: isDay === undefined ? undefined : isDay === 1,
    sunrise: timePart(first(daily.sunrise)),
    sunset: timePart(first(daily.sunset)),
  };
}

const cache = new Map<string, { at: number; info: PlaceInfo }>();
const CACHE_MS = 10 * 60 * 1000;

/** Forget cached place details (used by tests, and handy after a failed lookup). */
export function clearPlaceInfoCache(): void {
  cache.clear();
}

export async function fetchPlaceInfo(lat: number, lon: number, signal?: AbortSignal): Promise<PlaceInfo> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.info;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    '&current=temperature_2m,weather_code,wind_speed_10m,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1';
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Weather lookup failed (${res.status})`);
  const info = parseForecast(await res.json());
  if (!info) throw new Error('The weather service sent an unexpected answer.');
  cache.set(key, { at: Date.now(), info });
  return info;
}
