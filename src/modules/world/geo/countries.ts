// Real country shapes from Natural Earth (via the "world-atlas" package, public domain), 1:110m scale.
// Used to draw the Earth texture and to find which country a tapped point is in.
import { geoCentroid, geoContains } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

export type CountryFeature = Feature<Geometry, { name?: string }>;

export interface CountryInfo {
  name: string;
  /** Rough centre, for flying the globe there and for the no-3D country picker. */
  lat: number;
  lon: number;
}

let cache: Promise<CountryFeature[]> | null = null;

/** Loads the shapes once (the data is part of the app bundle, no network needed). */
export function loadCountries(): Promise<CountryFeature[]> {
  if (!cache) {
    cache = import('world-atlas/countries-110m.json').then((mod) => {
      const topo = mod.default as unknown as Topology;
      const fc = feature(topo, topo.objects.countries as GeometryCollection) as FeatureCollection<
        Geometry,
        { name?: string }
      >;
      return fc.features.filter((f) => f.geometry !== null);
    });
    cache.catch(() => {
      cache = null; // allow a retry after a failed load
    });
  }
  return cache;
}

/** The country containing a point, or null (open ocean, or a very small country at this map scale). */
export function countryAt(countries: readonly CountryFeature[], lat: number, lon: number): string | null {
  for (const c of countries) {
    if (c.properties?.name && geoContains(c, [lon, lat])) return c.properties.name;
  }
  return null;
}

/** Sorted list of countries with a rough centre, for the searchable list. */
export function countryList(countries: readonly CountryFeature[]): CountryInfo[] {
  return countries
    .filter((c) => c.properties?.name)
    .map((c) => {
      const [lon, lat] = geoCentroid(c);
      return { name: c.properties.name as string, lat, lon };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
