import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { Pulse } from './Pulse';
import { setNewsPlace } from '../../lib/newsContext';

describe('Pulse place context', () => {
  it('shows the place chosen in World and no fake headlines', () => {
    render(<Pulse />);
    expect(screen.queryByTestId('news-context')).not.toBeInTheDocument();
    act(() => setNewsPlace({ name: 'Tokyo', country: 'Japan', lat: 35.7, lon: 139.7 }));
    expect(screen.getByTestId('news-context')).toHaveTextContent('Tokyo, Japan');
    expect(screen.getByText(/No news source connected/i)).toBeInTheDocument();
    act(() => setNewsPlace(null));
  });
});
