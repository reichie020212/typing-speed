'use client';

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  createEngine,
  type EngineConfig,
  type EngineState,
  type Result,
  type TypingEngine,
} from '@/lib/engine';

export interface UseTypingEngineResult {
  state: EngineState;
  result: Result | null;
  handlers: {
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  };
  reset: () => void;
  extendSource: (more: string) => void;
  onPasteBlocked: (cb: () => void) => void;
}

export function useTypingEngine(config: EngineConfig): UseTypingEngineResult {
  const engineRef = useRef<TypingEngine | null>(null);
  if (engineRef.current === null) engineRef.current = createEngine(config);
  const engine = engineRef.current;

  const subscribe = useCallback((cb: () => void) => engine.subscribe(() => cb()), [engine]);
  const getSnapshot = useCallback(() => engine.getState(), [engine]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (state.status !== 'running') return;
    let raf = 0;
    const loop = () => {
      engine.tick(Date.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, state.status]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Tab' && state.status === 'running') {
        e.preventDefault();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        engine.backspace();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        engine.input(e.key);
      }
    },
    [engine, state.status],
  );

  const pasteCbRef = useRef<() => void>(() => {});
  const onPasteBlocked = useCallback((cb: () => void) => {
    pasteCbRef.current = cb;
  }, []);
  const onPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    pasteCbRef.current();
  }, []);

  const reset = useCallback(() => engine.reset(), [engine]);
  const extendSource = useCallback((more: string) => engine.extendSource(more), [engine]);

  const result = useMemo<Result | null>(() => {
    if (state.status !== 'finished') return null;
    return engine.getResult();
  }, [engine, state]);

  return {
    state,
    result,
    handlers: { onKeyDown, onPaste },
    reset,
    extendSource,
    onPasteBlocked,
  };
}
