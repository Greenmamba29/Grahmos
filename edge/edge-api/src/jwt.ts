import jwt from 'jsonwebtoken';
import type { CnfClaim, JwtPayload } from './types.js';

const ISS = process.env.JWT_ISSUER!;
const AUD = process.env.JWT_AUDIENCE!;
const TTL = parseInt(process.env.JWT_TTL_SECONDS || '300', 10);

/**
 * Sign a JWT with Proof-of-Possession binding to client certificate
 */
export function signShortJwt(sub: string, cnf: CnfClaim): string {
  const now = Math.floor(Date.now() / 1000);
  
  const payload: Omit<JwtPayload, 'cnf'> & { cnf: CnfClaim } = {
    iss: ISS,
    aud: AUD,
    sub,
    iat: now,
    exp: now + TTL,
    cnf
  };

  return jwt.sign(
    payload,
    getKey(),
    { algorithm: 'HS512' }
  );
}

/**
 * Verify JWT and return decoded payload
 */
export function verifyJwt(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getKey(), { 
      algorithms: ['HS512'], 
      audience: AUD, 
      issuer: ISS 
    });
    
    return decoded as JwtPayload;
  } catch (e) {
    console.error('JWT verification failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Get the JWT signing key from environment
 * In production, this should come from KMS/TPM
 */
function getKey(): string {
  const key = process.env.JWT_HS512_KEY;
  if (!key) {
    throw new Error('JWT_HS512_KEY environment variable is required');
  }
  if (key === 'default-dev-key-change-in-production') {
    console.warn('⚠️  Using default JWT key - change in production!');
  }
  return key;
}
