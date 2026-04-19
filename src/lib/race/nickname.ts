export type NicknameValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

const NICKNAME_RE = /^[A-Za-z0-9 _-]+$/;
const MAX_LEN = 16;

// Minimal blocklist for Phase 3. The curated wordlist in Phase 1 did a
// generation-time filter; this is a much shorter runtime guard focused on the
// obvious hits. Expand over time if reports come in.
const BLOCKLIST = new Set([
  'shit',
  'fuck',
  'cunt',
  'bitch',
  'asshole',
  'nigger',
  'faggot',
  'retard',
]);

export function validateNickname(raw: string): NicknameValidationResult {
  const trimmed = raw.trim();
  if (trimmed.length < 1) {
    return { ok: false, error: 'Nickname must be at least 1 character.' };
  }
  if (trimmed.length > MAX_LEN) {
    return { ok: false, error: `Nickname must be at most ${MAX_LEN} characters.` };
  }
  if (!NICKNAME_RE.test(trimmed)) {
    return {
      ok: false,
      error: 'Nickname may only contain letters, numbers, spaces, underscores, and dashes.',
    };
  }
  if (/^Guest-/i.test(trimmed)) {
    return { ok: false, error: 'The "Guest-" prefix is reserved.' };
  }
  const lower = trimmed.toLowerCase();
  for (const bad of BLOCKLIST) {
    if (lower.includes(bad)) {
      return { ok: false, error: 'That nickname is not allowed.' };
    }
  }
  return { ok: true, normalized: trimmed };
}
