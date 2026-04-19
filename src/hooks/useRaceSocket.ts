'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type Socket as ClientSocket, io as ioClient } from 'socket.io-client';
import type {
  EndedEvent,
  FinishedEvent,
  JoinedEvent,
  Participant,
  PhaseEvent,
  ProgressBroadcast,
  RaceErrorEvent,
  RacePhase,
  RosterEvent,
} from '@/lib/race/events';

export interface UseRaceSocketOpts {
  code: string;
  serverUrl: string;
  auth: { token?: string; nickname?: string };
}

export interface UseRaceSocketResult {
  phase: RacePhase | 'connecting' | 'disconnected';
  players: Participant[];
  me: Participant | null;
  passageText: string;
  countdownSeconds: number | null;
  results: EndedEvent['results'] | null;
  error: string | null;
  start(): void;
  sendProgress(data: { charIndex: number; wpm: number; accuracy: number }): void;
  sendFinish(data: { wpm: number; rawWpm: number; accuracy: number; durationMs: number }): void;
  leave(): void;
}

export function useRaceSocket(opts: UseRaceSocketOpts): UseRaceSocketResult {
  const [phase, setPhase] = useState<UseRaceSocketResult['phase']>('connecting');
  const [players, setPlayers] = useState<Participant[]>([]);
  const [me, setMe] = useState<Participant | null>(null);
  const [passageText, setPassageText] = useState('');
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [results, setResults] = useState<EndedEvent['results'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<ClientSocket | null>(null);

  useEffect(() => {
    const socket = ioClient(opts.serverUrl, {
      auth: opts.auth,
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', { code: opts.code });
    });
    socket.on('connect_error', (err) => setError(err.message));
    socket.on('joined', (e: JoinedEvent) => {
      setPhase(e.race.phase);
      setPlayers(e.race.players);
      setMe(e.you);
      setPassageText(e.race.passageText);
    });
    socket.on('roster', (e: RosterEvent) => {
      setPlayers(e.players);
      setMe((prev) => e.players.find((p) => p.playerId === prev?.playerId) ?? prev);
    });
    socket.on('phase', (e: PhaseEvent) => {
      setPhase(e.phase);
    });
    socket.on('countdown', (e: { secondsRemaining: number }) => {
      setCountdownSeconds(e.secondsRemaining);
    });
    socket.on('progress', (e: ProgressBroadcast) => {
      setPlayers((prev) =>
        prev.map((p) =>
          p.playerId === e.playerId
            ? { ...p, charIndex: e.charIndex, wpm: e.wpm, accuracy: e.accuracy }
            : p,
        ),
      );
    });
    socket.on('finished', (e: FinishedEvent) => {
      setPlayers((prev) =>
        prev.map((p) =>
          p.playerId === e.playerId
            ? { ...p, status: 'finished', finishPosition: e.finishPosition, wpm: e.wpm }
            : p,
        ),
      );
    });
    socket.on('ended', (e: EndedEvent) => {
      setPhase('ended');
      setResults(e.results);
    });
    socket.on('error', (e: RaceErrorEvent) => {
      setError(e.message);
    });
    socket.on('disconnect', () => {
      setPhase('disconnected');
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [opts.code, opts.serverUrl, opts.auth]);

  const start = useCallback(() => {
    socketRef.current?.emit('startRace', {});
  }, []);
  const sendProgress = useCallback<UseRaceSocketResult['sendProgress']>((data) => {
    socketRef.current?.emit('progress', data);
  }, []);
  const sendFinish = useCallback<UseRaceSocketResult['sendFinish']>((data) => {
    socketRef.current?.emit('finish', data);
  }, []);
  const leave = useCallback(() => {
    socketRef.current?.emit('leave', {});
  }, []);

  return {
    phase,
    players,
    me,
    passageText,
    countdownSeconds,
    results,
    error,
    start,
    sendProgress,
    sendFinish,
    leave,
  };
}
