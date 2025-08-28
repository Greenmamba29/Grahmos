import type { CnfClaim, JwtPayload } from './types.js';
/**
 * Sign a JWT with Proof-of-Possession binding to client certificate
 */
export declare function signShortJwt(sub: string, cnf: CnfClaim): string;
/**
 * Verify JWT and return decoded payload
 */
export declare function verifyJwt(token: string): JwtPayload | null;
//# sourceMappingURL=jwt.d.ts.map