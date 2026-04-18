'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiveWpm } from '@/components/typing/LiveWpm';
import { ModeSelector, type TestConfig } from '@/components/typing/ModeSelector';
import { ResultsPanel } from '@/components/typing/ResultsPanel';
import { TypingSurface } from '@/components/typing/TypingSurface';
import { useTypingEngine } from '@/hooks/useTypingEngine';
import { pickPassage, pickWords } from '@/lib/content/select';
import type { EngineConfig } from '@/lib/engine';
import { DEFAULT_CONFIG, loadConfig, saveConfig } from '@/lib/storage/config';

const INITIAL_WORDS_COUNT = 80;

function buildEngineConfig(config: TestConfig, regenKey: number): EngineConfig {
  const seed = `${regenKey}:${Date.now()}`;
  if (config.mode === 'fixed') {
    return {
      mode: 'fixed',
      source: pickPassage({ length: config.fixedLength, seed }).text,
    };
  }
  if (config.mode === 'time') {
    const words = pickWords({
      tier: config.difficulty,
      count: INITIAL_WORDS_COUNT,
      seed,
    });
    return {
      mode: 'time',
      source: words.join(' '),
      duration: config.timeDuration,
    };
  }
  const words = pickWords({
    tier: config.difficulty,
    count: config.wordsCount,
    seed,
  });
  return {
    mode: 'words',
    source: words.join(' '),
    wordCount: config.wordsCount,
  };
}

export default function SinglePlayerPage() {
  const [config, setConfig] = useState<TestConfig>(() => ({
    mode: DEFAULT_CONFIG.mode,
    fixedLength: DEFAULT_CONFIG.fixedLength,
    timeDuration: DEFAULT_CONFIG.timeDuration,
    wordsCount: DEFAULT_CONFIG.wordsCount,
    difficulty: DEFAULT_CONFIG.difficulty,
  }));
  const [regenKey, setRegenKey] = useState(0);

  useEffect(() => {
    const stored = loadConfig();
    setConfig({
      mode: stored.mode,
      fixedLength: stored.fixedLength,
      timeDuration: stored.timeDuration,
      wordsCount: stored.wordsCount,
      difficulty: stored.difficulty,
    });
  }, []);

  const handleConfigChange = useCallback((next: TestConfig) => {
    setConfig(next);
    saveConfig(next);
    setRegenKey((k) => k + 1);
  }, []);

  const engineConfig = useMemo(() => buildEngineConfig(config, regenKey), [config, regenKey]);

  return (
    <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col gap-8 px-6 py-10">
      <ModeSelector value={config} onChange={handleConfigChange} />
      <Runner
        key={`${regenKey}:${engineConfig.mode}`}
        engineConfig={engineConfig}
        modeConfig={config}
        onRegenerate={() => setRegenKey((k) => k + 1)}
      />
    </section>
  );
}

interface RunnerProps {
  engineConfig: EngineConfig;
  modeConfig: TestConfig;
  onRegenerate: () => void;
}

function Runner({ engineConfig, modeConfig, onRegenerate }: RunnerProps) {
  const { state, result, handlers, reset, extendSource, onPasteBlocked } =
    useTypingEngine(engineConfig);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const [pasteToast, setPasteToast] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, [state.status]);

  const handleClick = useCallback(() => inputRef.current?.focus(), []);

  useEffect(() => {
    onPasteBlocked(() => {
      setPasteToast(true);
      setTimeout(() => setPasteToast(false), 1600);
    });
  }, [onPasteBlocked]);

  useEffect(() => {
    if (engineConfig.mode !== 'time') return;
    if (state.needMoreWords) {
      const more = pickWords({
        tier: modeConfig.difficulty,
        count: 25,
        seed: `extend:${Math.random()}`,
      });
      extendSource(` ${more.join(' ')}`);
    }
  }, [state.needMoreWords, extendSource, engineConfig.mode, modeConfig.difficulty]);

  useEffect(() => {
    if (state.status !== 'finished') return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onRegenerate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        reset();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.status, onRegenerate, reset]);

  const showResults = state.status === 'finished' && result !== null;

  return (
    <div className="flex flex-col items-center gap-6" onClick={handleClick}>
      <div className="h-8">
        {state.status === 'running' ? (
          <LiveWpm
            state={state}
            mode={engineConfig.mode}
            source={engineConfig.source}
            duration={engineConfig.duration}
            wordCount={engineConfig.wordCount}
          />
        ) : null}
      </div>

      <input
        ref={inputRef}
        aria-label="typing input"
        onKeyDown={handlers.onKeyDown}
        onPaste={handlers.onPaste}
        onBlur={() => inputRef.current?.focus()}
        className="absolute opacity-0 pointer-events-none"
        tabIndex={-1}
      />

      <TypingSurface
        source={engineConfig.source}
        state={state}
        dimmed={state.status === 'finished'}
      />

      {state.status === 'idle' ? (
        <p className="text-sm text-[color:var(--muted)]">press any key to start</p>
      ) : null}

      {showResults ? (
        <ResultsPanel
          result={result}
          onNext={onRegenerate}
          onRestart={reset}
          onChangeMode={onRegenerate}
          nextButtonRef={nextBtnRef}
        />
      ) : null}

      {pasteToast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-[color:var(--surface)] px-4 py-2 text-sm text-[color:var(--muted)] shadow-lg"
        >
          Paste is disabled
        </div>
      ) : null}
    </div>
  );
}
