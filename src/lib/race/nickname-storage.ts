const KEY = 'race:nickname';

export function getStoredNickname(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setStoredNickname(nickname: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, nickname);
  } catch {
    // ignore
  }
}
