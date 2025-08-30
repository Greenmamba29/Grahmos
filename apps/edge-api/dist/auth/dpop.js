import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
/**
 * Base64URL encode a buffer or string
 */
const base64url = (input) => {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return buffer
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
};
/**
 * Generate JWK thumbprint according to RFC 7638
 */
const generateJwkThumbprint = (jwk) => {
    // Create canonical JWK representation for thumbprint
    const canonicalJwk = {};
    // Required fields depend on key type
    if (jwk.kty === 'RSA') {
        canonicalJwk.kty = jwk.kty;
        canonicalJwk.n = jwk.n;
        canonicalJwk.e = jwk.e;
    }
    else if (jwk.kty === 'EC') {
        canonicalJwk.crv = jwk.crv;
        canonicalJwk.kty = jwk.kty;
        canonicalJwk.x = jwk.x;
        canonicalJwk.y = jwk.y;
    }
    else if (jwk.kty === 'OKP') {
        canonicalJwk.crv = jwk.crv;
        canonicalJwk.kty = jwk.kty;
        canonicalJwk.x = jwk.x;
    }
    // Sort keys and create SHA-256 hash
    const sortedKeys = Object.keys(canonicalJwk).sort();
    const sortedJwk = {};
    sortedKeys.forEach(key => {
        sortedJwk[key] = canonicalJwk[key];
    });
    const jwkString = JSON.stringify(sortedJwk);
    return base64url(crypto.createHash('sha256').update(jwkString).digest());
};
/**
 * Validate DPoP proof JWT
 */
const validateDPoPProof = (dpopToken, method, uri) => {
    try {
        const parts = dpopToken.split('.');
        if (parts.length !== 3) {
            return { valid: false, error: 'Invalid DPoP token format' };
        }
        // Decode header and payload
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        // Validate header
        if (header.typ !== 'dpop+jwt') {
            return { valid: false, error: 'Invalid DPoP token type' };
        }
        if (header.alg !== 'RS256' && header.alg !== 'ES256') {
            return { valid: false, error: 'Unsupported DPoP algorithm' };
        }
        if (!header.jwk) {
            return { valid: false, error: 'Missing JWK in DPoP header' };
        }
        // Create public key from JWK
        const publicKey = crypto.createPublicKey({
            key: header.jwk,
            format: 'jwk'
        });
        // Verify signature
        const signatureValid = crypto.verify(header.alg === 'RS256' ? 'sha256' : 'sha256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'));
        if (!signatureValid) {
            return { valid: false, error: 'Invalid DPoP signature' };
        }
        // Validate payload claims
        const now = Math.floor(Date.now() / 1000);
        const maxAge = parseInt(process.env.DPOP_MAX_AGE || '300');
        if (!payload.htm || payload.htm !== method) {
            return { valid: false, error: 'DPoP htm claim mismatch' };
        }
        if (!payload.htu || !uri.includes(payload.htu)) {
            return { valid: false, error: 'DPoP htu claim mismatch' };
        }
        if (!payload.iat || Math.abs(now - payload.iat) > maxAge) {
            return { valid: false, error: 'DPoP token too old or future-dated' };
        }
        if (!payload.jti) {
            return { valid: false, error: 'Missing DPoP jti claim' };
        }
        // Generate JWK thumbprint
        const jkt = generateJwkThumbprint(header.jwk);
        return { valid: true, jkt };
    }
    catch (error) {
        return { valid: false, error: `DPoP validation error: ${error}` };
    }
};
/**
 * DPoP middleware - validates DPoP proof if present
 */
export function requireDPoP(req, res, next) {
    // Skip DPoP validation if mTLS is already verified
    if (req.header('X-Client-Verify') === 'SUCCESS') {
        return next();
    }
    const dpopHeader = req.header('DPoP');
    // For auth endpoints, DPoP is required
    if (req.path.startsWith('/auth/dpop')) {
        if (!dpopHeader) {
            return res.status(401).json({
                error: 'DPoP proof required',
                code: 'DPOP_REQUIRED'
            });
        }
    }
    // If DPoP header is present, validate it
    if (dpopHeader) {
        const method = req.method.toUpperCase();
        const uri = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const validation = validateDPoPProof(dpopHeader, method, uri);
        if (!validation.valid) {
            return res.status(401).json({
                error: 'Invalid DPoP proof',
                code: 'DPOP_INVALID',
                details: validation.error
            });
        }
        // Store JWK thumbprint for PoP JWT validation
        req.dpopThumb = validation.jkt;
    }
    next();
}
/**
 * PoP JWT validation middleware
 */
export function requirePoPJWT(req, res, next) {
    // Skip JWT validation for auth endpoints
    if (req.path.startsWith('/auth/') || req.path === '/health') {
        return next();
    }
    const authHeader = req.header('Authorization');
    const match = authHeader?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        return res.status(401).json({
            error: 'JWT token required',
            code: 'JWT_REQUIRED'
        });
    }
    const token = match[1];
    try {
        // Verify JWT
        const claims = jwt.verify(token, process.env.JWT_HS512_KEY, {
            algorithms: ['HS512'],
            audience: process.env.JWT_AUDIENCE,
            issuer: process.env.JWT_ISSUER,
            clockTolerance: 30
        });
        const cnf = claims.cnf;
        if (!cnf) {
            return res.status(401).json({
                error: 'Missing confirmation claim',
                code: 'CNF_MISSING'
            });
        }
        // Validate confirmation claim based on auth method
        const isMtls = req.header('X-Client-Verify') === 'SUCCESS';
        const clientFingerprint = req.header('X-Client-Fingerprint');
        const jkt = req.dpopThumb;
        if (isMtls) {
            // mTLS: validate x5t#S256 claim
            if (!cnf['x5t#S256'] || cnf['x5t#S256'] !== clientFingerprint) {
                return res.status(401).json({
                    error: 'Certificate confirmation mismatch',
                    code: 'CNF_MISMATCH'
                });
            }
        }
        else {
            // DPoP: validate jkt claim
            if (!cnf.jkt || cnf.jkt !== jkt) {
                return res.status(401).json({
                    error: 'Key confirmation mismatch',
                    code: 'CNF_MISMATCH'
                });
            }
        }
        // Store validated claims
        req.jwtClaims = claims;
        req.authMethod = isMtls ? 'mtls' : 'dpop';
        next();
    }
    catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                error: 'Token expired',
                code: 'JWT_EXPIRED'
            });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({
                error: 'Invalid token',
                code: 'JWT_INVALID'
            });
        }
        return res.status(500).json({
            error: 'Token validation failed',
            code: 'JWT_ERROR'
        });
    }
}
//# sourceMappingURL=dpop.js.map