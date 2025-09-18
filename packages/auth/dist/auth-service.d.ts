/**
 * Grahmos Authentication Service
 * Phase 11: Enterprise Security & User Management
 *
 * Comprehensive authentication system with:
 * - JWT token management with RS256
 * - Multi-factor authentication (TOTP)
 * - Secure session management
 * - Password policies and validation
 * - Account lockout and rate limiting
 * - Audit logging
 */
export interface User {
    id: string;
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    roles: string[];
    isActive: boolean;
    emailVerified: boolean;
    mfaEnabled: boolean;
    mfaSecret?: string;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    passwordChangedAt?: Date;
    loginAttempts: number;
    lockedUntil?: Date;
    metadata?: Record<string, any>;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    tokenType: 'Bearer';
}
export interface LoginRequest {
    email: string;
    password: string;
    mfaCode?: string;
    rememberMe?: boolean;
    userAgent?: string;
    ipAddress?: string;
}
export interface AuthSession {
    id: string;
    userId: string;
    deviceId?: string;
    userAgent?: string;
    ipAddress?: string;
    createdAt: Date;
    lastActivityAt: Date;
    expiresAt: Date;
    isActive: boolean;
}
export interface AuthConfig {
    jwtSecret: string;
    jwtPublicKey: string;
    jwtPrivateKey: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    sessionExpiry: string;
    maxLoginAttempts: number;
    lockoutDuration: number;
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireLowercase: boolean;
    passwordRequireNumbers: boolean;
    passwordRequireSymbols: boolean;
    mfaIssuer: string;
    mfaServiceName: string;
    redisUrl?: string;
    auditLogEnabled: boolean;
}
export declare class AuthenticationService {
    private config;
    private redis?;
    private userStore;
    private sessionStore;
    constructor(config: AuthConfig);
    private hashPassword;
    private verifyPassword;
    private validatePasswordStrength;
    private generateTokens;
    private parseExpiry;
    private verifyToken;
    generateMfaSecret(): {
        secret: string;
        qrCodeUrl: string;
        backupCodes: string[];
    };
    private verifyMfaCode;
    private createSession;
    private getSession;
    private invalidateSession;
    private checkRateLimit;
    private isAccountLocked;
    private auditLog;
    createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'loginAttempts'>): Promise<User>;
    getUserById(id: string): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    updateUser(user: User): Promise<User>;
    register(email: string, password: string, userData?: Partial<User>): Promise<{
        user: User;
        tokens: AuthTokens;
    }>;
    login(request: LoginRequest): Promise<{
        user: User;
        tokens: AuthTokens;
        requiresMfa: boolean;
    }>;
    logout(sessionId: string, userId?: string): Promise<void>;
    refreshToken(refreshToken: string): Promise<AuthTokens>;
    validateAccessToken(token: string): Promise<{
        user: User;
        session: AuthSession;
    } | null>;
    enableMfa(userId: string): Promise<{
        secret: string;
        qrCodeUrl: string;
        backupCodes: string[];
    }>;
    disableMfa(userId: string, mfaCode: string): Promise<void>;
    getUserSessions(userId: string): Promise<AuthSession[]>;
    revokeSession(sessionId: string, userId: string): Promise<void>;
    revokeAllSessions(userId: string, excludeSessionId?: string): Promise<void>;
}
export declare function createAuthMiddleware(authService: AuthenticationService): {
    loginRateLimit: import("express-rate-limit").RateLimitRequestHandler;
    authenticate: (req: any, res: any, next: any) => Promise<any>;
    requireRole: (...roles: string[]) => (req: any, res: any, next: any) => any;
};
export default AuthenticationService;
//# sourceMappingURL=auth-service.d.ts.map