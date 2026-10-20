import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { World } from './World';
import { clearPlaceInfoCache } from './placeApi';
import { addFavorite, reloadFavorites } from '../../storage/favorites';
import { resetSettings } from '../../storage/settings';

const forecast = {
  timezone: 'Asia/Tokyo',
  timezone_abbreviation: 'JST',
  utc_offset_seconds: 32400,
  current: { temperature_2m: 18.4, weather_code: 3, wind_speed_10m: 9.1, is_day: 1 },
  daily: { sunrise: ['2026-10-19T05:40'], sunset: ['2026-10-19T16:55'] },
};

beforeEach(() => {
  window.localStorage.clear();
  resetSettings();
  reloadFavorites();
  clearPlaceInfoCache();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => forecast }));
});
afterEach(() => vi.unstubAllGlobals());

describe('World module', () => {
  it('switches between sections with the tab bar', async () => {
    const user = userEvent.setup();
    render(<World />);
    expect(await screen.findByRole('tab', { name: 'Globe', selected: true })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Timer' }));
    expect(await screen.findByRole('timer', { name: 'Stopwatch' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Calendar' }));
    expect(await screen.findByRole('group', { name: 'View' })).toBeInTheDocument();
  });

  it('falls back to a country list when 3D graphics are not available', async () => {
    render(<World />);
    expect(await screen.findByText(/3D Earth is not available here/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Japan' }, { timeout: 5000 })).toBeInTheDocument();
  });

  it('shows local time, weather and credit for a picked country, and can save it', async () => {
    const user = userEvent.setup();
    render(<World />);
    await user.click(await screen.findByRole('button', { name: 'Japan' }, { timeout: 5000 }));
    expect(await screen.findByTestId('place-title')).toHaveTextContent('Japan');
    expect(await screen.findByText('Overcast')).toBeInTheDocument();
    expect(screen.getByTestId('place-time')).toBeInTheDocument();
    expect(screen.getByText('Open-Meteo.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save to world clock/i }));
    expect(await screen.findByText(/saved to your world clock/i)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'World clock' }));
    expect(await screen.findAllByTestId('clock-card')).toHaveLength(1);
  });

  it('is honest when the weather service cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const user = userEvent.setup();
    render(<World />);
    await user.click(await screen.findByRole('button', { name: 'Japan' }, { timeout: 5000 }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/offline|could not reach/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('world clock shows an empty state, then saved cities', async () => {
    const user = userEvent.setup();
    render(<World />);
    await user.click(await screen.findByRole('tab', { name: 'World clock' }));
    expect(await screen.findByText(/No saved cities yet/i)).toBeInTheDocument();
    act(() => {
      addFavorite({ id: 'x', name: 'Sydney', country: 'Australia', lat: -33.9, lon: 151.2, timezone: 'Australia/Sydney' });
    });
    const card = await screen.findByTestId('clock-card');
    expect(within(card).getByText('Sydney')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Remove Sydney' }));
    expect(await screen.findByText(/No saved cities yet/i)).toBeInTheDocument();
  });

  it('calendar: validates, adds and deletes an event', async () => {
    const user = userEvent.setup();
    render(<World />);
    await user.click(await screen.findByRole('tab', { name: 'Calendar' }));
    await user.click(await screen.findByRole('button', { name: 'Add event' }));
    const form = screen.getByRole('form', { name: 'New event' });
    await user.click(within(form).getByRole('button', { name: 'Add event' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent(/title/i);
    await user.type(within(form).getByLabelText('Title'), 'Dentist');
    await user.click(within(form).getByRole('button', { name: 'Add event' }));
    expect((await screen.findAllByText('Dentist')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Delete Dentist' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(screen.queryByText('Dentist')).not.toBeInTheDocument();
  });

  it('timer starts and pauses; stopwatch starts', async () => {
    const user = userEvent.setup();
    render(<World />);
    await user.click(await screen.findByRole('tab', { name: 'Timer' }));
    await user.click(await screen.findByRole('button', { name: '1 min' }));
    const startButtons = screen.getAllByRole('button', { name: 'Start' });
    await user.click(startButtons[0]);
    expect(await screen.findByRole('timer', { name: 'Timer' })).toHaveTextContent(/^0[01]:\d\d$/);
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });
});
