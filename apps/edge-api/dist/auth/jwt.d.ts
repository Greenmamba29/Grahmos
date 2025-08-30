/**
 * Generate a short-lived PoP JWT with confirmation claim
 */
export declare function signShortJwt(subject: string, cnf: any): string;
/**
 * Verify and decode a JWT token
 */
export declare function verifyJwt(token: string): any;
/**
 * Generate a random JWT secret key
 */
export declare function generateJwtSecret(): string;
//# sourceMappingURL=jwt.d.ts.map