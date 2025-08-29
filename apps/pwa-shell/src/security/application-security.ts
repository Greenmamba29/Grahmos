/**
 * Grahmos Application Security Implementation
 * Comprehensive security middleware, input validation, and protection mechanisms
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import crypto from 'crypto';
import { createHash } from 'crypto';

// Types
interface SecurityConfig {
  rateLimiting: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  };
  slowDown: {
    windowMs: number;
    delayAfter: number;
    delayMs: number;
    maxDelayMs: number;
  };
  helmet: {
    contentSecurityPolicy: {
      directives: Record<string, string[]>;
    };
    hsts: {
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
  };
  validation: {
    maxBodySize: string;
    allowedFileTypes: string[];
    maxFileSize: number;
  };
}

interface SecurityEvent {
  type: 'RATE_LIMIT_EXCEEDED' | 'INVALID_INPUT' | 'SUSPICIOUS_ACTIVITY' | 'XSS_ATTEMPT' | 'SQL_INJECTION_ATTEMPT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: string;
  details: Record<string, any>;
  timestamp: Date;
}

// Security Configuration
const securityConfig: SecurityConfig = {
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },
  slowDown: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // Allow 50 requests per windowMs without delay
    delayMs: 500, // Add 500ms delay per request after delayAfter
    maxDelayMs: 20000 // Maximum delay of 20 seconds
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        childSrc: ["'none'"],
        workerSrc: ["'self'", "blob:"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: []
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    }
  },
  validation: {
    maxBodySize: '10mb',
    allowedFileTypes: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.txt'],
    maxFileSize: 10 * 1024 * 1024 // 10MB
  }
};

// Security Event Logger
class SecurityEventLogger {
  private events: SecurityEvent[] = [];

  log(event: SecurityEvent): void {
    this.events.push(event);
    
    // Log to console (in production, send to proper logging service)
    console.warn(`[SECURITY EVENT] ${event.type} - ${event.severity}`, {
      source: event.source,
      details: event.details,
      timestamp: event.timestamp
    });

    // Trigger alerts for high-severity events
    if (event.severity === 'HIGH' || event.severity === 'CRITICAL') {
      this.triggerAlert(event);
    }
  }

  private triggerAlert(event: SecurityEvent): void {
    // In production, integrate with alerting system (PagerDuty, Slack, etc.)
    console.error(`[SECURITY ALERT] ${event.type}`, event);
  }

  getEvents(filters?: Partial<SecurityEvent>): SecurityEvent[] {
    if (!filters) return this.events;
    
    return this.events.filter(event => {
      return Object.entries(filters).every(([key, value]) => 
        event[key as keyof SecurityEvent] === value
      );
    });
  }

  getEventsSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    this.events.forEach(event => {
      summary[event.type] = (summary[event.type] || 0) + 1;
    });
    return summary;
  }
}

const securityLogger = new SecurityEventLogger();

// Security Middleware Factory
export class ApplicationSecurityMiddleware {
  private config: SecurityConfig;
  private logger: SecurityEventLogger;

  constructor(config: SecurityConfig = securityConfig, logger: SecurityEventLogger = securityLogger) {
    this.config = config;
    this.logger = logger;
  }

  // Helmet Security Headers
  helmetMiddleware() {
    return helmet({
      contentSecurityPolicy: {
        directives: this.config.helmet.contentSecurityPolicy.directives,
        reportOnly: false
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      dnsPrefetchControl: true,
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: this.config.helmet.hsts,
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      xssFilter: true
    });
  }

  // Rate Limiting Middleware
  rateLimitMiddleware() {
    return rateLimit({
      windowMs: this.config.rateLimiting.windowMs,
      max: this.config.rateLimiting.max,
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: this.config.rateLimiting.skipSuccessfulRequests,
      skipFailedRequests: this.config.rateLimiting.skipFailedRequests,
      handler: (req: Request, res: Response) => {
        this.logger.log({
          type: 'RATE_LIMIT_EXCEEDED',
          severity: 'MEDIUM',
          source: req.ip,
          details: {
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent')
          },
          timestamp: new Date()
        });

        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.round(this.config.rateLimiting.windowMs / 1000)
        });
      },
      keyGenerator: (req: Request) => {
        // Use combination of IP and user ID for authenticated requests
        const userId = (req as any).user?.id;
        return userId ? `${req.ip}:${userId}` : req.ip;
      }
    });
  }

  // Slow Down Middleware (Progressive Delays)
  slowDownMiddleware() {
    return slowDown({
      windowMs: this.config.slowDown.windowMs,
      delayAfter: this.config.slowDown.delayAfter,
      delayMs: this.config.slowDown.delayMs,
      maxDelayMs: this.config.slowDown.maxDelayMs,
      skipFailedRequests: false,
      skipSuccessfulRequests: false,
      onLimitReached: (req: Request) => {
        this.logger.log({
          type: 'RATE_LIMIT_EXCEEDED',
          severity: 'LOW',
          source: req.ip,
          details: {
            path: req.path,
            method: req.method,
            slowDownApplied: true
          },
          timestamp: new Date()
        });
      }
    });
  }

  // Input Sanitization Middleware
  sanitizationMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Sanitize request body
        if (req.body && typeof req.body === 'object') {
          req.body = this.sanitizeObject(req.body);
        }

        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
          req.query = this.sanitizeObject(req.query);
        }

        // Sanitize route parameters
        if (req.params && typeof req.params === 'object') {
          req.params = this.sanitizeObject(req.params);
        }

        next();
      } catch (error) {
        this.logger.log({
          type: 'INVALID_INPUT',
          severity: 'MEDIUM',
          source: req.ip,
          details: {
            path: req.path,
            method: req.method,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          timestamp: new Date()
        });

        res.status(400).json({
          error: 'Invalid input',
          message: 'Request contains invalid or potentially malicious content'
        });
      }
    };
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeValue(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeValue(key);
      sanitized[sanitizedKey] = this.sanitizeObject(value);
    }

    return sanitized;
  }

  private sanitizeValue(value: any): any {
    if (typeof value !== 'string') {
      return value;
    }

    // Check for potential XSS attempts
    if (this.containsXSS(value)) {
      this.logger.log({
        type: 'XSS_ATTEMPT',
        severity: 'HIGH',
        source: 'input_validation',
        details: { suspiciousInput: value.substring(0, 100) },
        timestamp: new Date()
      });
    }

    // Check for potential SQL injection attempts
    if (this.containsSQLInjection(value)) {
      this.logger.log({
        type: 'SQL_INJECTION_ATTEMPT',
        severity: 'HIGH',
        source: 'input_validation',
        details: { suspiciousInput: value.substring(0, 100) },
        timestamp: new Date()
      });
    }

    // Sanitize the value
    return DOMPurify.sanitize(value, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });
  }

  private containsXSS(input: string): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
      /vbscript:/gi,
      /expression\(/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  private containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT( +INTO)?|MERGE|SELECT|UNION( +ALL)?|UPDATE)\b)/gi,
      /(\b(AND|OR)\b.{1,6}?(=|>|<|\!=|<>|<=|>=|\|\|))/gi,
      /(['"]\s*(;|--|\||#))/gi,
      /(\bCHAR\s*\(\s*\d+\s*\))/gi,
      /(\bOR\s+\d+\s*=\s*\d+)/gi,
      /(\bUNION\s+(ALL\s+)?SELECT)/gi
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  // Request Validation Middleware
  validationMiddleware<T>(schema: z.ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const validatedData = schema.parse({
          body: req.body,
          query: req.query,
          params: req.params
        });

        // Attach validated data to request
        (req as any).validated = validatedData;
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          this.logger.log({
            type: 'INVALID_INPUT',
            severity: 'LOW',
            source: req.ip,
            details: {
              path: req.path,
              method: req.method,
              validationErrors: error.errors
            },
            timestamp: new Date()
          });

          res.status(400).json({
            error: 'Validation failed',
            message: 'Request data does not meet validation requirements',
            details: error.errors
          });
        } else {
          next(error);
        }
      }
    };
  }

  // File Upload Security Middleware
  fileUploadSecurityMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.file && !req.files) {
        return next();
      }

      const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];

      for (const file of files) {
        if (!file) continue;

        // Check file size
        if (file.size > this.config.validation.maxFileSize) {
          return res.status(400).json({
            error: 'File too large',
            message: `File size must be less than ${this.config.validation.maxFileSize / (1024 * 1024)}MB`
          });
        }

        // Check file type
        const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        if (!this.config.validation.allowedFileTypes.includes(fileExtension)) {
          return res.status(400).json({
            error: 'Invalid file type',
            message: `File type ${fileExtension} is not allowed`
          });
        }

        // Check for malicious content
        if (this.containsMaliciousContent(file.buffer || Buffer.from(''))) {
          this.logger.log({
            type: 'SUSPICIOUS_ACTIVITY',
            severity: 'HIGH',
            source: req.ip,
            details: {
              fileName: file.originalname,
              fileSize: file.size,
              reason: 'Potentially malicious file content detected'
            },
            timestamp: new Date()
          });

          return res.status(400).json({
            error: 'Malicious content detected',
            message: 'The uploaded file contains potentially malicious content'
          });
        }
      }

      next();
    };
  }

  private containsMaliciousContent(buffer: Buffer): boolean {
    const content = buffer.toString();
    const maliciousPatterns = [
      /<script/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload=/gi,
      /onerror=/gi,
      /<?php/gi,
      /<%/g,
      /exec\(/gi,
      /eval\(/gi
    ];

    return maliciousPatterns.some(pattern => pattern.test(content));
  }

  // CSRF Protection Middleware
  csrfProtectionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF for GET, HEAD, OPTIONS requests
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      // Skip CSRF for API endpoints with valid JWT
      if (req.path.startsWith('/api/') && (req as any).user) {
        return next();
      }

      const token = req.headers['x-csrf-token'] || req.body._csrf || req.query._csrf;
      const sessionToken = (req.session as any)?.csrfToken;

      if (!token || !sessionToken || token !== sessionToken) {
        this.logger.log({
          type: 'SUSPICIOUS_ACTIVITY',
          severity: 'MEDIUM',
          source: req.ip,
          details: {
            path: req.path,
            method: req.method,
            reason: 'CSRF token validation failed'
          },
          timestamp: new Date()
        });

        return res.status(403).json({
          error: 'CSRF token validation failed',
          message: 'Invalid or missing CSRF token'
        });
      }

      next();
    };
  }

  // Request Integrity Middleware
  requestIntegrityMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check for suspicious headers
      const suspiciousHeaders = [
        'x-forwarded-for',
        'x-real-ip',
        'x-originating-ip'
      ];

      for (const header of suspiciousHeaders) {
        const value = req.headers[header];
        if (value && typeof value === 'string' && this.containsSuspiciousIP(value)) {
          this.logger.log({
            type: 'SUSPICIOUS_ACTIVITY',
            severity: 'MEDIUM',
            source: req.ip,
            details: {
              suspiciousHeader: header,
              value: value,
              reason: 'Suspicious IP address in headers'
            },
            timestamp: new Date()
          });
        }
      }

      // Check User-Agent for suspicious patterns
      const userAgent = req.get('User-Agent') || '';
      if (this.containsSuspiciousUserAgent(userAgent)) {
        this.logger.log({
          type: 'SUSPICIOUS_ACTIVITY',
          severity: 'LOW',
          source: req.ip,
          details: {
            userAgent: userAgent,
            reason: 'Suspicious User-Agent pattern detected'
          },
          timestamp: new Date()
        });
      }

      next();
    };
  }

  private containsSuspiciousIP(ip: string): boolean {
    // Check for private IP ranges that shouldn't be forwarded
    const privateRanges = [
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^127\./,
      /^169\.254\./
    ];

    return privateRanges.some(pattern => pattern.test(ip));
  }

  private containsSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /curl/i,
      /wget/i,
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /scanner/i,
      /^$/,
      /sqlmap/i,
      /nikto/i,
      /nmap/i
    ];

    // Allow legitimate bots (Google, Bing, etc.)
    const legitimateBots = [
      /googlebot/i,
      /bingbot/i,
      /slurp/i,
      /duckduckbot/i,
      /baiduspider/i,
      /yandexbot/i
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
    const isLegitimate = legitimateBots.some(pattern => pattern.test(userAgent));

    return isSuspicious && !isLegitimate;
  }

  // Security Headers Response Middleware
  securityHeadersMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add custom security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      
      // Add cache control for sensitive endpoints
      if (req.path.includes('/admin') || req.path.includes('/api/auth')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }

      next();
    };
  }

  // Get security middleware stack
  getSecurityStack() {
    return [
      this.helmetMiddleware(),
      this.securityHeadersMiddleware(),
      this.slowDownMiddleware(),
      this.rateLimitMiddleware(),
      this.requestIntegrityMiddleware(),
      this.sanitizationMiddleware(),
      this.csrfProtectionMiddleware()
    ];
  }

  // Get security metrics
  getSecurityMetrics() {
    return {
      events: this.logger.getEventsSummary(),
      recentEvents: this.logger.getEvents().slice(-10),
      config: this.config
    };
  }
}

// Validation Schemas
export const ValidationSchemas = {
  // User registration schema
  userRegistration: z.object({
    body: z.object({
      email: z.string().email().max(254),
      username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
      password: z.string().min(12).max(128).regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      ),
      firstName: z.string().min(1).max(100).optional(),
      lastName: z.string().min(1).max(100).optional()
    })
  }),

  // User login schema
  userLogin: z.object({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(1),
      mfaToken: z.string().length(6).regex(/^\d{6}$/).optional()
    })
  }),

  // Search query schema
  searchQuery: z.object({
    query: z.object({
      q: z.string().min(1).max(500),
      limit: z.string().regex(/^\d+$/).optional(),
      offset: z.string().regex(/^\d+$/).optional(),
      sort: z.enum(['relevance', 'date', 'title']).optional()
    })
  }),

  // File upload schema
  fileUpload: z.object({
    body: z.object({
      description: z.string().max(1000).optional(),
      tags: z.array(z.string().max(50)).max(10).optional()
    })
  }),

  // Admin user update schema
  adminUserUpdate: z.object({
    body: z.object({
      firstName: z.string().min(1).max(100).optional(),
      lastName: z.string().min(1).max(100).optional(),
      roles: z.array(z.string().min(1).max(50)).optional(),
      isActive: z.boolean().optional()
    }),
    params: z.object({
      userId: z.string().uuid()
    })
  })
};

// Export the security middleware instance
export const securityMiddleware = new ApplicationSecurityMiddleware();

// Export validation helper
export const validateRequest = <T>(schema: z.ZodSchema<T>) => 
  securityMiddleware.validationMiddleware(schema);

export default ApplicationSecurityMiddleware;
