export const RACE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const RACE_CODE_LENGTH = 6;

export function generateRaceCode(): string {
  let out = '';
  for (let i = 0; i < RACE_CODE_LENGTH; i++) {
    out += RACE_CODE_ALPHABET.charAt(Math.floor(Math.random() * RACE_CODE_ALPHABET.length));
  }
  return out;
}
