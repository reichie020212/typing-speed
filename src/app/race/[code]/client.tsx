'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Lobby } from '@/components/race/Lobby';
import { NicknameModal } from '@/components/race/NicknameModal';
import { useRaceSocket } from '@/hooks/useRaceSocket';
import { getStoredNickname, setStoredNickname } from '@/lib/race/nickname-storage';

export interface RaceClientProps {
  code: string;
  serverUrl: string;
  loggedIn: boolean;
}

export function RaceClient({ code, serverUrl, loggedIn }: RaceClientProps) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Fetch token for logged-in, or hydrate nickname for guests.
  useEffect(() => {
    if (loggedIn) {
      (async () => {
        const res = await fetch('/api/race/token', { method: 'POST' });
        if (res.ok) {
          const { token: t } = (await res.json()) as { token: string };
          setToken(t);
        }
        setBootstrapped(true);
      })();
    } else {
      setNickname(getStoredNickname());
      setBootstrapped(true);
    }
  }, [loggedIn]);

  const authPayload = useMemo(
    () => (token ? { token } : nickname ? { nickname } : null),
    [token, nickname],
  );

  const socket = useRaceSocket(
    authPayload
      ? { code, serverUrl, auth: authPayload }
      : // Dummy payload; we don't actually connect until bootstrapped + authPayload set.
        { code, serverUrl, auth: { nickname: '__pending__' } },
  );

  if (!bootstrapped) {
    return <div className="p-10 text-center text-[color:var(--muted)]">connecting\u2026</div>;
  }
  if (!loggedIn && !nickname) {
    return (
      <NicknameModal
        onConfirm={(n) => {
          setStoredNickname(n);
          setNickname(n);
        }}
      />
    );
  }

  if (socket.error) {
    return (
      <section className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Can&apos;t join this race</h1>
        <p className="mt-2 text-[color:var(--muted)]">{socket.error}</p>
        <Link href="/race" className="mt-6 inline-block text-[color:var(--accent)] hover:underline">
          Back to lobby
        </Link>
      </section>
    );
  }

  if (socket.phase === 'connecting' || socket.phase === 'disconnected') {
    return (
      <div className="p-10 text-center text-[color:var(--muted)]">connecting to race\u2026</div>
    );
  }

  if (socket.phase === 'waiting') {
    return (
      <Lobby
        code={code}
        players={socket.players}
        me={socket.me}
        onStart={socket.start}
        onLeave={() => {
          socket.leave();
          router.push('/race');
        }}
      />
    );
  }

  // Placeholder for remaining phases — wired in Tasks 21-22.
  return (
    <div className="p-10 text-center text-[color:var(--muted)]">
      phase: {socket.phase} (coming next)
    </div>
  );
}
