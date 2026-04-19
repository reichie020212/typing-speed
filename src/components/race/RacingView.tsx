'use client';

import { useCallback, useEffect, useRef } from 'react';
import { TypingSurface } from '@/components/typing/TypingSurface';
import { useTypingEngine } from '@/hooks/useTypingEngine';
import type { Participant } from '@/lib/race/events';
import { ProgressRails } from './ProgressRails';

const PROGRESS_THROTTLE_MS = 100; // 10/sec

export function RacingView({
  passageText,
  players,
  mePlayerId,
  onProgress,
  onFinish,
}: {
  passageText: string;
  players: Participant[];
  mePlayerId: string | null;
  onProgress: (d: { charIndex: number; wpm: number; accuracy: number }) => void;
  onFinish: (d: { wpm: number; rawWpm: number; accuracy: number; durationMs: number }) => void;
}) {
  const { state, result, handlers } = useTypingEngine({
    mode: 'fixed',
    source: passageText,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSentAt = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Throttled progress broadcast
  useEffect(() => {
    if (state.status !== 'running') return;
    const now = performance.now();
    if (now - lastSentAt.current < PROGRESS_THROTTLE_MS) return;
    lastSentAt.current = now;
    const elapsed = state.startedAt ? (now - state.startedAt) / 1000 / 60 : 0;
    const correctChars = state.timeline.filter((e) => e.kind === 'input' && e.correct).length;
    const totalInput = state.timeline.filter((e) => e.kind === 'input').length;
    const wpm = elapsed > 0 ? correctChars / 5 / elapsed : 0;
    const accuracy = totalInput > 0 ? correctChars / totalInput : 1;
    onProgress({ charIndex: state.cursor, wpm, accuracy });
  }, [state, onProgress]);

  useEffect(() => {
    if (state.status !== 'finished') return;
    if (finishedRef.current) return;
    if (!result) return;
    finishedRef.current = true;
    onFinish({
      wpm: result.wpm,
      rawWpm: result.rawWpm,
      accuracy: result.accuracy,
      durationMs: result.durationMs,
    });
  }, [state.status, result, onFinish]);

  const handleClick = useCallback(() => inputRef.current?.focus(), []);

  return (
    <section
      className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col gap-8 px-6 py-8"
      onClick={handleClick}
    >
      <ProgressRails players={players} sourceLength={passageText.length} mePlayerId={mePlayerId} />

      <input
        ref={inputRef}
        aria-label="typing input"
        onKeyDown={handlers.onKeyDown}
        onPaste={handlers.onPaste}
        onBlur={() => inputRef.current?.focus()}
        className="absolute opacity-0 pointer-events-none"
        tabIndex={-1}
      />

      <TypingSurface source={passageText} state={state} dimmed={state.status === 'finished'} />
    </section>
  );
}
