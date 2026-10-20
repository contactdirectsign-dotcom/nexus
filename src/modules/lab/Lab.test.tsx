import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Lab } from './Lab';
import { resetSettings } from '../../storage/settings';

beforeEach(() => {
  window.localStorage.clear();
  resetSettings();
});

describe('Gesture Lab', () => {
  it('has three sections and explains the air cursor moves', async () => {
    const user = userEvent.setup();
    render(<Lab />);
    expect(screen.getByRole('tab', { name: 'Air Draw', selected: true })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'How it works' }));
    expect(screen.getByText(/Pinch \(thumb \+ index\)/)).toBeInTheDocument();
    expect(screen.getByText('Air cursor on')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /turn air cursor off/i }));
    expect(screen.getByText('Air cursor off')).toBeInTheDocument();
  });

  it('draw board: brush buttons and undo/clear start disabled until something is drawn', () => {
    render(<Lab />);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cyan brush' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Cyan brush' }));
    expect(screen.getByRole('button', { name: 'Cyan brush' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('draw board: a pointer stroke enables undo and clear', () => {
    render(<Lab />);
    const surface = screen.getByTestId('draw-surface');
    fireEvent.pointerDown(surface, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 40, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 80, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 80, clientY: 50, pointerId: 1 });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('target practice: popping targets scores points and a round ends with a result', async () => {
    vi.useFakeTimers();
    try {
      render(<Lab />);
      fireEvent.click(screen.getByRole('tab', { name: 'Target practice' }));
      fireEvent.click(screen.getByRole('button', { name: 'Start' }));
      const target = screen.getByRole('button', { name: 'Target' });
      fireEvent.pointerDown(target);
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Target' }));
      expect(screen.getByTestId('score')).toHaveTextContent('2');
      await act(async () => {
        vi.advanceTimersByTime(31_000);
      });
      expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
      expect(window.localStorage.getItem('nexus.lab.best.v1')).toBe('2');
    } finally {
      vi.useRealTimers();
    }
  });
});
