import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// Session payload structure
export interface SessionPayload extends JWTPayload {
  userId: string;
  discordId: string;
  username: string;
  avatar?: string;
  isAdmin: boolean;
  iat: number;
  exp: number;
}

// Get the secret key as Uint8Array for jose
function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // In development, use a default (not secure for production!)
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Using default SESSION_SECRET. Set a secure one in production!');
      return new TextEncoder().encode('development-secret-key-change-in-production-32chars');
    }
    throw new Error('SESSION_SECRET environment variable is required');
  }

  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters');
  }

  return new TextEncoder().encode(secret);
}

// Session duration
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Create a signed JWT session token
 */
export async function createSessionToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  const secret = getSecretKey();
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    ...payload,
    iat: now,
    exp: now + SESSION_DURATION,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_DURATION)
    .sign(secret);

  return token;
}

/**
 * Verify and decode a JWT session token
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret);

    // Validate required fields
    if (!payload.userId || !payload.discordId || !payload.username) {
      console.error('Invalid session payload: missing required fields');
      return null;
    }

    return payload as SessionPayload;
  } catch (error) {
    // Token is invalid, expired, or tampered with
    if (error instanceof Error) {
      // Only log unexpected errors, not expired tokens
      if (!error.message.includes('expired')) {
        console.error('Session verification failed:', error.message);
      }
    }
    return null;
  }
}

/**
 * Check if a session token is close to expiring (within 1 day)
 */
export function shouldRefreshSession(payload: SessionPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  const oneDayInSeconds = 24 * 60 * 60;
  return (payload.exp - now) < oneDayInSeconds;
}

/**
 * Create a refreshed session token with updated expiration
 */
export async function refreshSessionToken(payload: SessionPayload): Promise<string> {
  // Create new token with same data but fresh timestamps
  return createSessionToken({
    userId: payload.userId,
    discordId: payload.discordId,
    username: payload.username,
    avatar: payload.avatar,
    isAdmin: payload.isAdmin,
  });
}
