import { Request } from 'express';

// Sanitize log input to prevent log injection
function sanitizeLogInput(input: string): string {
  // Remove newlines and carriage returns to prevent log injection
  return input
    .replace(/[\r\n]/g, ' ')
    .replace(/\t/g, ' ')
    .trim();
}

// Mask sensitive data in logs
function maskSensitiveData(data: any): any {
  if (typeof data === 'string') {
    // Mask JWT tokens
    if (data.match(/^Bearer\s+.+$/i)) {
      return 'Bearer [REDACTED]';
    }
    // Mask potential API keys or secrets (long alphanumeric strings)
    if (data.length > 20 && /^[a-zA-Z0-9+/=]+$/.test(data)) {
      return `${data.substring(0, 4)}...[REDACTED]`;
    }
    return sanitizeLogInput(data);
  }
  
  if (typeof data === 'object' && data !== null) {
    const masked: any = Array.isArray(data) ? [] : {};
    for (const key in data) {
      const lowerKey = key.toLowerCase();
      // Mask common sensitive field names
      if (lowerKey.includes('password') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('token') ||
          lowerKey.includes('key') ||
          lowerKey.includes('authorization')) {
        masked[key] = '[REDACTED]';
      } else {
        masked[key] = maskSensitiveData(data[key]);
      }
    }
    return masked;
  }
  
  return data;
}

// Enhanced logging function
export function log(level: string, message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  const sanitizedMessage = sanitizeLogInput(message);
  const maskedMeta = meta ? maskSensitiveData(meta) : undefined;
  
  const logEntry = {
    timestamp,
    level,
    message: sanitizedMessage,
    ...(maskedMeta && { meta: maskedMeta })
  };
  
  if (process.env.LOG_FORMAT === 'json') {
    console.log(JSON.stringify(logEntry));
  } else {
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${sanitizedMessage}`, maskedMeta || '');
  }
}

// Middleware to log requests with sanitization
export function requestLogger(req: Request, _res: any, next: any) {
  const { method, path, query, headers } = req;
  
  // Create sanitized request info
  const requestInfo = {
    method,
    path: sanitizeLogInput(path),
    query: maskSensitiveData(query),
    userAgent: sanitizeLogInput(headers['user-agent'] || 'unknown'),
    ip: req.ip
  };
  
  log('info', 'Incoming request', requestInfo);
  next();
}

// Convenience functions
export const logInfo = (message: string, meta?: any) => log('info', message, meta);
export const logWarn = (message: string, meta?: any) => log('warn', message, meta);
export const logError = (message: string, meta?: any) => log('error', message, meta);
export const logDebug = (message: string, meta?: any) => log('debug', message, meta);