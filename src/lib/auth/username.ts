export const RESERVED_USERNAMES = new Set([
  'me',
  'admin',
  'api',
  'auth',
  'signin',
  'signout',
  'signup',
  'settings',
  'new',
  'edit',
  'null',
  'undefined',
  'profile',
  'dashboard',
  'history',
  'leaderboard',
  'single-player',
  'race',
]);

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{2,23}$/;

export function deriveBase(seed: string | null | undefined): string {
  if (!seed) return 'user';
  const cleaned = seed
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
  if (cleaned.length >= 3) return cleaned;
  return `user-${cleaned}`.slice(0, 20).replace(/-$/, '');
}

export function isValidUsername(u: string): boolean {
  if (!USERNAME_RE.test(u)) return false;
  if (RESERVED_USERNAMES.has(u)) return false;
  return true;
}

export function randomSuffix(): string {
  // 3 base-36 chars = ~15 bits of entropy; collision resistant for the small
  // retry loop we run during username generation.
  return Math.random().toString(36).slice(2, 5).padEnd(3, '0');
}
