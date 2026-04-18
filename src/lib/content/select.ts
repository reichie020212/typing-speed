import type { Difficulty } from '@/lib/engine/types';
import { PASSAGES, type Passage } from './passages';
import { WORDS_EASY, WORDS_HARD, WORDS_MEDIUM } from './words';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed?: string): () => number {
  if (seed) return mulberry32(hashString(seed));
  return Math.random;
}

export function pickPassage(opts: { length: 'short' | 'medium' | 'long'; seed?: string }): Passage {
  const pool = PASSAGES.filter((p) => p.length === opts.length);
  if (pool.length === 0) throw new Error(`No passages of length ${opts.length}`);
  const r = rng(opts.seed);
  const idx = Math.floor(r() * pool.length);
  const picked = pool[idx];
  if (!picked) throw new Error('Pick failed');
  return picked;
}

const PUNCT_SUFFIXES = [',', '.', ';', "'"];
const HARD_PUNCT_PROBABILITY = 0.12;

export function pickWords(opts: { tier: Difficulty; count: number; seed?: string }): string[] {
  const pool =
    opts.tier === 'easy' ? WORDS_EASY : opts.tier === 'medium' ? WORDS_MEDIUM : WORDS_HARD;
  const r = rng(opts.seed);
  const out: string[] = [];
  for (let i = 0; i < opts.count; i++) {
    const base = pool[Math.floor(r() * pool.length)];
    if (!base) continue;
    let w = base;
    if (opts.tier === 'hard' && r() < HARD_PUNCT_PROBABILITY) {
      const p = PUNCT_SUFFIXES[Math.floor(r() * PUNCT_SUFFIXES.length)];
      if (p) w = w + p;
    }
    out.push(w);
  }
  return out;
}
