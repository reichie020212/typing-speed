import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResultsPanel } from '@/components/typing/ResultsPanel';

const result = {
  wpm: 68.4,
  rawWpm: 72.1,
  accuracy: 0.947,
  chars: { correct: 120, incorrect: 5, extra: 2, missed: 0 },
  durationMs: 30_000,
};

describe('ResultsPanel', () => {
  it('renders WPM and accuracy headline', () => {
    render(
      <ResultsPanel
        result={result}
        onNext={() => {}}
        onRestart={() => {}}
        onChangeMode={() => {}}
      />,
    );
    expect(screen.getByText('68')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('fires callbacks on button click', () => {
    const onNext = vi.fn();
    const onRestart = vi.fn();
    const onChangeMode = vi.fn();
    render(
      <ResultsPanel
        result={result}
        onNext={onNext}
        onRestart={onRestart}
        onChangeMode={onChangeMode}
      />,
    );
    fireEvent.click(screen.getByText('Next test'));
    fireEvent.click(screen.getByText('Restart'));
    fireEvent.click(screen.getByText('Change mode'));
    expect(onNext).toHaveBeenCalled();
    expect(onRestart).toHaveBeenCalled();
    expect(onChangeMode).toHaveBeenCalled();
  });
});
