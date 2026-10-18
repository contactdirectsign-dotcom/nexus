import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { getSettings, resetSettings } from '../storage/settings';

beforeEach(() => {
  window.location.hash = '';
  resetSettings();
});

describe('NEXUS shell', () => {
  it('shows branding, clock and gesture status on the dashboard', () => {
    render(<App />);
    expect(screen.getByText('NEXUS')).toBeInTheDocument();
    expect(screen.getByTestId('clock')).toBeInTheDocument();
    expect(screen.getByTestId('gesture-status')).toHaveTextContent(/setup needed/i);
  });

  it('shows honest empty states instead of fake news', () => {
    render(<App />);
    expect(screen.getByText(/No news source connected yet/i)).toBeInTheDocument();
  });

  it('navigates between modules with the navigation buttons', async () => {
    const user = userEvent.setup();
    render(<App />);
    const [nav] = screen.getAllByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('button', { name: /world/i }));
    expect(await screen.findByText(/World is not built yet/i)).toBeInTheDocument();
    await user.click(within(nav).getByRole('button', { name: /pulse/i }));
    expect(await screen.findByText(/No news source connected$/i)).toBeInTheDocument();
  });

  it('opens settings from the top bar button', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(await screen.findByText('Gesture assignments')).toBeInTheDocument();
  });
});

describe('Settings screen', () => {
  it('changes the time format and saves it', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/settings';
    render(<App />);
    const select = await screen.findByLabelText('Time format');
    await user.selectOptions(select, '12h');
    expect(getSettings().timeFormat).toBe('12h');
  });

  it('reassigns a gesture and unassigns its previous owner', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/settings';
    render(<App />);
    const select = await screen.findByLabelText('Gesture for Select');
    await user.selectOptions(select, 'swipe-right');
    expect(getSettings().mappings.select).toBe('swipe-right');
    expect(getSettings().mappings['next-panel']).toBeNull();
  });

  it('toggles reduced effects on the page', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/settings';
    render(<App />);
    await user.click(await screen.findByRole('switch', { name: 'Reduced effects' }));
    expect(getSettings().reducedEffects).toBe(true);
    expect(document.documentElement.dataset.reduced).toBe('true');
  });

  it('asks for confirmation before erasing data', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/settings';
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Erase data' }));
    expect(screen.getByRole('button', { name: 'Yes, erase' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Erase data' })).toBeInTheDocument();
  });
});
