import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TypingSurface } from '@/components/typing/TypingSurface';
import type { EngineState } from '@/lib/engine';

function stateWith(input: string): EngineState {
  return {
    status: 'running',
    input,
    cursor: input.length,
    startedAt: 0,
    endedAt: null,
    timeline: [],
    needMoreWords: false,
  };
}

describe('TypingSurface', () => {
  it('renders a span per source char', () => {
    const { container } = render(<TypingSurface source="hello" state={stateWith('')} />);
    const spans = container.querySelectorAll('span[data-idx]');
    expect(spans.length).toBe(5);
  });

  it('applies the correct-class to typed-correct positions', () => {
    const { container } = render(<TypingSurface source="hello" state={stateWith('he')} />);
    const zero = container.querySelector('span[data-idx="0"]');
    expect(zero?.className).toContain('var(--fg)');
  });

  it('marks a wrong char with danger color', () => {
    const { container } = render(<TypingSurface source="hello" state={stateWith('hx')} />);
    const one = container.querySelector('span[data-idx="1"]');
    expect(one?.className).toContain('var(--danger)');
  });
});
