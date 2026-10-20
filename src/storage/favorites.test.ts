import { beforeEach, describe, expect, it } from 'vitest';
import { addFavorite, FAVORITES_KEY, getFavorites, MAX_FAVORITES, reloadFavorites, removeFavorite, sanitizeFavorites, type Favorite } from './favorites';

const city = (id: string, tz = 'Asia/Tokyo'): Favorite => ({ id, name: id, lat: 1, lon: 2, timezone: tz });

describe('favourites', () => {
  beforeEach(() => {
    window.localStorage.clear();
    reloadFavorites();
  });

  it('adds, de-duplicates, removes and persists', () => {
    expect(addFavorite(city('a'))).toBe(true);
    expect(addFavorite(city('a'))).toBe(true);
    expect(getFavorites()).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]')).toHaveLength(1);
    reloadFavorites();
    expect(getFavorites()).toHaveLength(1);
    removeFavorite('a');
    expect(getFavorites()).toHaveLength(0);
  });

  it('refuses invalid time zones and a full list', () => {
    expect(addFavorite(city('bad', 'Mars/Olympus'))).toBe(false);
    for (let i = 0; i < MAX_FAVORITES; i++) addFavorite(city(`c${i}`));
    expect(addFavorite(city('extra'))).toBe(false);
    expect(getFavorites()).toHaveLength(MAX_FAVORITES);
  });

  it('cleans corrupted storage', () => {
    expect(sanitizeFavorites('nope')).toEqual([]);
    expect(sanitizeFavorites([city('ok'), { id: 1 }, null, city('ok'), city('z', 'bad/zone')])).toHaveLength(1);
    window.localStorage.setItem(FAVORITES_KEY, '{not json');
    reloadFavorites();
    expect(getFavorites()).toEqual([]);
  });
});
