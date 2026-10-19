import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { gestureStatus } from './TopBar';
import { engine } from '../gestures/engine';
import { getSettings, resetSettings } from '../storage/settings';

beforeEach(() => {
  window.location.hash = '';
  resetSettings();
});

afterEach(() => {
  engine.stop();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('gestureStatus', () => {
  const base = { gestureEnabled: false, setupComplete: false };

  it('asks for setup first', () => {
    expect(gestureStatus(base).label).toMatch(/setup needed/i);
  });

  it('shows off / ready states once set up', () => {
    expect(gestureStatus({ ...base, setupComplete: true }).label).toMatch(/off/i);
    expect(gestureStatus({ gestureEnabled: true, setupComplete: true }).label).toMatch(/ready/i);
  });

  it('reflects the live camera state', () => {
    expect(gestureStatus(base, 'running')).toEqual({ label: 'Gestures: active', tone: 'ok' });
    expect(gestureStatus(base, 'paused').label).toMatch(/paused/i);
    expect(gestureStatus(base, 'error').label).toMatch(/problem/i);
  });
});

describe('setup wizard (without a camera)', () => {
  it('opens from the dashboard "Set up gestures" button', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Set up gestures' }));
    expect(await screen.findByRole('button', { name: 'Start setup' })).toBeInTheDocument();
  });

  it('opens from Settings and explains the camera before asking for it', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/settings';
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Start setup' }));
    expect(await screen.findByText(/never recorded, saved or uploaded/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start setup' }));
    expect(await screen.findByRole('button', { name: 'Allow camera' })).toBeInTheDocument();
  });

  it('shows a helpful message when camera permission is denied', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
    const user = userEvent.setup();
    window.location.hash = '#/setup';
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Start setup' }));
    await user.click(await screen.findByRole('button', { name: 'Allow camera' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts[0]).toHaveTextContent(/camera permission was denied/i);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    // Touch fallback is always offered
    expect(screen.getByRole('button', { name: /continue without camera/i })).toBeInTheDocument();
  });

  it('reports a missing camera API instead of crashing', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/setup';
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Start setup' }));
    await user.click(await screen.findByRole('button', { name: 'Allow camera' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts[0]).toHaveTextContent(/secure|camera/i);
  });

  it('skip goes to the dashboard without enabling gestures', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/setup';
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /skip: use touch only/i }));
    expect(window.location.hash).toBe('#/dashboard');
    expect(getSettings().gestureEnabled).toBe(false);
    expect(getSettings().setupComplete).toBe(false);
  });
});

describe('settings gesture controls', () => {
  it('keeps the camera switch disabled until setup is done', async () => {
    window.location.hash = '#/settings';
    render(<App />);
    expect(await screen.findByRole('switch', { name: 'Camera gesture control' })).toBeDisabled();
  });
});
