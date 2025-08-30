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

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { sign, verify, SignOptions, VerifyOptions } from 'jsonwebtoken';
import { authenticator } from 'otplib';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { Redis } from 'ioredis';

// Types
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
  accessTokenExpiry: string; // e.g., '15m'
  refreshTokenExpiry: string; // e.g., '7d'
  sessionExpiry: string; // e.g., '1h'
  maxLoginAttempts: number;
  lockoutDuration: number; // minutes
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

export class AuthenticationService {
  private config: AuthConfig;
  private redis?: Redis;
  private userStore: Map<string, User> = new Map();
  private sessionStore: Map<string, AuthSession> = new Map();

  constructor(config: AuthConfig) {
    this.config = config;
    
    if (config.redisUrl) {
      this.redis = new Redis(config.redisUrl);
    }
    
    // Configure TOTP
    authenticator.options = {
      window: 2, // Allow 2 time steps of variance
      step: 30,  // 30 second time step
    };
  }

  // Password utilities
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < this.config.passwordMinLength) {
      errors.push(`Password must be at least ${this.config.passwordMinLength} characters long`);
    }
    
    if (this.config.passwordRequireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (this.config.passwordRequireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (this.config.passwordRequireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (this.config.passwordRequireSymbols && !/[^a-zA-Z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    // Check for common weak passwords
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', '1234567890'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common and not allowed');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // JWT token management
  private generateTokens(user: User, sessionId: string): AuthTokens {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      sessionId,
      iat: Math.floor(Date.now() / 1000),
    };

    const accessTokenOptions: SignOptions = {
      algorithm: 'RS256',
      expiresIn: this.config.accessTokenExpiry,
      issuer: 'grahmos-auth',
      audience: 'grahmos-api',
    };

    const refreshTokenOptions: SignOptions = {
      algorithm: 'RS256',
      expiresIn: this.config.refreshTokenExpiry,
      issuer: 'grahmos-auth',
      audience: 'grahmos-refresh',
    };

    const accessToken = sign(payload, this.config.jwtPrivateKey, accessTokenOptions);
    const refreshToken = sign({ ...payload, type: 'refresh' }, this.config.jwtPrivateKey, refreshTokenOptions);

    const expiresAt = new Date(Date.now() + this.parseExpiry(this.config.accessTokenExpiry));

    return {
      accessToken,
      refreshToken,
      expiresAt,
      tokenType: 'Bearer',
    };
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error('Invalid expiry format');
    
    const [, value, unit] = match;
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return parseInt(value) * multipliers[unit as keyof typeof multipliers];
  }

  private async verifyToken(token: string, audience = 'grahmos-api'): Promise<any> {
    const options: VerifyOptions = {
      algorithms: ['RS256'],
      issuer: 'grahmos-auth',
      audience,
    };

    return verify(token, this.config.jwtPublicKey, options);
  }

  // Multi-factor authentication
  generateMfaSecret(): { secret: string; qrCodeUrl: string; backupCodes: string[] } {
    const secret = authenticator.generateSecret();
    const qrCodeUrl = authenticator.keyuri(
      'user@example.com', // This would be the actual user email
      this.config.mfaServiceName,
      secret
    );

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () => 
      randomBytes(4).toString('hex').toUpperCase()
    );

    return {
      secret,
      qrCodeUrl,
      backupCodes,
    };
  }

  private verifyMfaCode(secret: string, code: string): boolean {
    return authenticator.verify({ token: code, secret });
  }

  // Session management
  private async createSession(user: User, request: LoginRequest): Promise<AuthSession> {
    const session: AuthSession = {
      id: randomBytes(32).toString('hex'),
      userId: user.id,
      userAgent: request.userAgent,
      ipAddress: request.ipAddress,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + this.parseExpiry(this.config.sessionExpiry)),
      isActive: true,
    };

    this.sessionStore.set(session.id, session);
    
    if (this.redis) {
      await this.redis.setex(
        `session:${session.id}`,
        this.parseExpiry(this.config.sessionExpiry) / 1000,
        JSON.stringify(session)
      );
    }

    return session;
  }

  private async getSession(sessionId: string): Promise<AuthSession | null> {
    if (this.redis) {
      const sessionData = await this.redis.get(`session:${sessionId}`);
      return sessionData ? JSON.parse(sessionData) : null;
    }
    
    return this.sessionStore.get(sessionId) || null;
  }

  private async invalidateSession(sessionId: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(`session:${sessionId}`);
    }
    
    this.sessionStore.delete(sessionId);
  }

  // Rate limiting and account lockout
  private async checkRateLimit(identifier: string, action: string): Promise<boolean> {
    const key = `rate_limit:${action}:${identifier}`;
    const current = await this.redis?.incr(key) || 0;
    
    if (current === 1) {
      await this.redis?.expire(key, 300); // 5 minutes
    }
    
    const limit = action === 'login' ? 5 : 10;
    return current <= limit;
  }

  private async isAccountLocked(userId: string): Promise<boolean> {
    const user = this.userStore.get(userId);
    if (!user) return false;
    
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return true;
    }
    
    if (user.loginAttempts >= this.config.maxLoginAttempts) {
      // Lock the account
      user.lockedUntil = new Date(Date.now() + this.config.lockoutDuration * 60000);
      await this.updateUser(user);
      return true;
    }
    
    return false;
  }

  // Audit logging
  private async auditLog(
    action: string,
    userId?: string,
    details?: Record<string, any>,
    ipAddress?: string
  ): Promise<void> {
    if (!this.config.auditLogEnabled) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      userId,
      details,
      ipAddress,
      service: 'grahmos-auth',
    };
    
    // In a real implementation, this would go to a proper audit log system
    console.log('[AUDIT]', JSON.stringify(logEntry));
    
    if (this.redis) {
      await this.redis.lpush('audit_logs', JSON.stringify(logEntry));
      await this.redis.ltrim('audit_logs', 0, 10000); // Keep last 10k entries
    }
  }

  // User management
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'loginAttempts'>): Promise<User> {
    const user: User = {
      ...userData,
      id: randomBytes(16).toString('hex'),
      createdAt: new Date(),
      updatedAt: new Date(),
      loginAttempts: 0,
    };
    
    this.userStore.set(user.id, user);
    await this.auditLog('user_created', user.id, { email: user.email });
    
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userStore.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    for (const user of this.userStore.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async updateUser(user: User): Promise<User> {
    user.updatedAt = new Date();
    this.userStore.set(user.id, user);
    await this.auditLog('user_updated', user.id);
    return user;
  }

  // Authentication methods
  async register(
    email: string,
    password: string,
    userData?: Partial<User>
  ): Promise<{ user: User; tokens: AuthTokens }> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    
    // Check if user already exists
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }
    
    // Validate password strength
    const passwordValidation = this.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }
    
    // Hash password
    const passwordHash = await this.hashPassword(password);
    
    // Create user
    const user = await this.createUser({
      email,
      roles: ['user'],
      isActive: true,
      emailVerified: false,
      mfaEnabled: false,
      ...userData,
      // Note: password hash would be stored separately in a real implementation
    });
    
    // Create initial session
    const session = await this.createSession(user, { email, password });
    
    // Generate tokens
    const tokens = this.generateTokens(user, session.id);
    
    await this.auditLog('user_registered', user.id, { email }, undefined);
    
    return { user, tokens };
  }

  async login(request: LoginRequest): Promise<{ user: User; tokens: AuthTokens; requiresMfa: boolean }> {
    const { email, password, mfaCode, ipAddress } = request;
    
    // Rate limiting
    const rateLimitOk = await this.checkRateLimit(email, 'login');
    if (!rateLimitOk) {
      await this.auditLog('login_rate_limited', undefined, { email }, ipAddress);
      throw new Error('Too many login attempts. Please try again later.');
    }
    
    // Get user
    const user = await this.getUserByEmail(email);
    if (!user) {
      await this.auditLog('login_failed', undefined, { email, reason: 'user_not_found' }, ipAddress);
      throw new Error('Invalid credentials');
    }
    
    // Check account lock
    const isLocked = await this.isAccountLocked(user.id);
    if (isLocked) {
      await this.auditLog('login_blocked', user.id, { reason: 'account_locked' }, ipAddress);
      throw new Error('Account is temporarily locked due to multiple failed login attempts');
    }
    
    // Verify password (in real implementation, hash would be retrieved from secure storage)
    const passwordValid = await this.verifyPassword(password, 'stored_hash_here');
    if (!passwordValid) {
      user.loginAttempts += 1;
      await this.updateUser(user);
      await this.auditLog('login_failed', user.id, { reason: 'invalid_password' }, ipAddress);
      throw new Error('Invalid credentials');
    }
    
    // Check if MFA is required
    if (user.mfaEnabled) {
      if (!mfaCode) {
        return { user, tokens: {} as AuthTokens, requiresMfa: true };
      }
      
      // Verify MFA code
      if (!user.mfaSecret || !this.verifyMfaCode(user.mfaSecret, mfaCode)) {
        await this.auditLog('login_failed', user.id, { reason: 'invalid_mfa' }, ipAddress);
        throw new Error('Invalid MFA code');
      }
    }
    
    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lastLoginAt = new Date();
    await this.updateUser(user);
    
    // Create session
    const session = await this.createSession(user, request);
    
    // Generate tokens
    const tokens = this.generateTokens(user, session.id);
    
    await this.auditLog('login_success', user.id, { 
      sessionId: session.id,
      userAgent: request.userAgent 
    }, ipAddress);
    
    return { user, tokens, requiresMfa: false };
  }

  async logout(sessionId: string, userId?: string): Promise<void> {
    await this.invalidateSession(sessionId);
    await this.auditLog('logout', userId, { sessionId });
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = await this.verifyToken(refreshToken, 'grahmos-refresh');
      
      if (payload.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }
      
      const user = await this.getUserById(payload.sub);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }
      
      // Verify session still exists
      const session = await this.getSession(payload.sessionId);
      if (!session || !session.isActive) {
        throw new Error('Session expired');
      }
      
      // Generate new tokens
      const tokens = this.generateTokens(user, session.id);
      
      await this.auditLog('token_refreshed', user.id, { sessionId: session.id });
      
      return tokens;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async validateAccessToken(token: string): Promise<{ user: User; session: AuthSession } | null> {
    try {
      const payload = await this.verifyToken(token);
      
      const user = await this.getUserById(payload.sub);
      if (!user || !user.isActive) {
        return null;
      }
      
      const session = await this.getSession(payload.sessionId);
      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return null;
      }
      
      // Update last activity
      session.lastActivityAt = new Date();
      if (this.redis) {
        await this.redis.setex(
          `session:${session.id}`,
          this.parseExpiry(this.config.sessionExpiry) / 1000,
          JSON.stringify(session)
        );
      }
      
      return { user, session };
    } catch (error) {
      return null;
    }
  }

  // MFA management
  async enableMfa(userId: string): Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const mfaSetup = this.generateMfaSecret();
    
    user.mfaSecret = mfaSetup.secret;
    user.mfaEnabled = true;
    await this.updateUser(user);
    
    await this.auditLog('mfa_enabled', userId);
    
    return mfaSetup;
  }

  async disableMfa(userId: string, mfaCode: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    if (!user.mfaSecret || !this.verifyMfaCode(user.mfaSecret, mfaCode)) {
      throw new Error('Invalid MFA code');
    }
    
    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    await this.updateUser(user);
    
    await this.auditLog('mfa_disabled', userId);
  }

  // Session management
  async getUserSessions(userId: string): Promise<AuthSession[]> {
    const sessions: AuthSession[] = [];
    
    for (const session of this.sessionStore.values()) {
      if (session.userId === userId && session.isActive && session.expiresAt > new Date()) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error('Session not found');
    }
    
    await this.invalidateSession(sessionId);
    await this.auditLog('session_revoked', userId, { sessionId });
  }

  async revokeAllSessions(userId: string, excludeSessionId?: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    
    for (const session of sessions) {
      if (session.id !== excludeSessionId) {
        await this.invalidateSession(session.id);
      }
    }
    
    await this.auditLog('all_sessions_revoked', userId, { 
      revokedCount: sessions.length,
      excludedSession: excludeSessionId 
    });
  }
}

// Express.js middleware factory
export function createAuthMiddleware(authService: AuthenticationService) {
  return {
    // Rate limiting middleware
    loginRateLimit: rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      message: 'Too many login attempts, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
    }),

    // Authentication middleware
    authenticate: async (req: any, res: any, next: any) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.substring(7);
        const authResult = await authService.validateAccessToken(token);
        
        if (!authResult) {
          return res.status(401).json({ error: 'Invalid or expired token' });
        }

        req.user = authResult.user;
        req.session = authResult.session;
        next();
      } catch (error) {
        res.status(401).json({ error: 'Authentication failed' });
      }
    },

    // Authorization middleware
    requireRole: (...roles: string[]) => {
      return (req: any, res: any, next: any) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const hasRole = roles.some(role => req.user.roles.includes(role));
        if (!hasRole) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
      };
    },
  };
}

export default AuthenticationService;
