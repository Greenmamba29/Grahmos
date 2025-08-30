import jwt from 'jsonwebtoken';
/**
 * Generate a short-lived PoP JWT with confirmation claim
 */
export function signShortJwt(subject, cnf) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = parseInt(process.env.JWT_TTL_SECONDS || '300');
    const payload = {
        iss: process.env.JWT_ISSUER || 'edge.grahmos.local',
        aud: process.env.JWT_AUDIENCE || 'grahmos-clients',
        sub: subject,
        iat: now,
        exp: now + ttl,
        cnf // Confirmation claim (x5t#S256 for mTLS, jkt for DPoP)
    };
    const secret = process.env.JWT_HS512_KEY;
    if (!secret) {
        throw new Error('JWT_HS512_KEY environment variable is required');
    }
    return jwt.sign(payload, secret, { algorithm: 'HS512' });
}
/**
 * Verify and decode a JWT token
 */
export function verifyJwt(token) {
    const secret = process.env.JWT_HS512_KEY;
    if (!secret) {
        throw new Error('JWT_HS512_KEY environment variable is required');
    }
    return jwt.verify(token, secret, {
        algorithms: ['HS512'],
        audience: process.env.JWT_AUDIENCE || 'grahmos-clients',
        issuer: process.env.JWT_ISSUER || 'edge.grahmos.local',
        clockTolerance: 30
    });
}
/**
 * Generate a random JWT secret key
 */
export function generateJwtSecret() {
    const crypto = require('crypto');
    return crypto.randomBytes(64).toString('base64');
}
//# sourceMappingURL=jwt.js.map