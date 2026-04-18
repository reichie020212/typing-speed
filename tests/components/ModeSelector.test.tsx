import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModeSelector, type TestConfig } from '@/components/typing/ModeSelector';

const base: TestConfig = {
  mode: 'fixed',
  fixedLength: 'medium',
  timeDuration: 30,
  wordsCount: 25,
  difficulty: 'medium',
};

describe('ModeSelector', () => {
  it('renders mode + length controls for fixed mode', () => {
    render(<ModeSelector value={base} onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'mode' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'length' })).toBeInTheDocument();
  });

  it('swaps controls when mode changes to time', () => {
    render(<ModeSelector value={{ ...base, mode: 'time' }} onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'duration' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'length' })).toBeNull();
  });

  it('fires onChange with the patched config on click', () => {
    const onChange = vi.fn();
    render(<ModeSelector value={base} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'time' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'time' }));
  });
});
