import { jwtVerify, SignJWT } from 'jose';

export interface RaceTokenPayload {
  userId: string;
  username: string;
}

const ALG = 'HS256';
const DEFAULT_TTL_SECONDS = 300; // 5 minutes

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function mintRaceToken(
  payload: RaceTokenPayload,
  secret: string,
  opts: { ttlSeconds?: number } = {},
): Promise<string> {
  const ttl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(secretKey(secret));
}

export async function verifyRaceToken(
  token: string,
  secret: string,
): Promise<RaceTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: [ALG] });
  if (typeof payload.userId !== 'string' || typeof payload.username !== 'string') {
    throw new Error('Invalid race token payload');
  }
  return { userId: payload.userId, username: payload.username };
}
