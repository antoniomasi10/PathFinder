import { logger } from './logger';

type SecurityEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'REGISTER'
  | 'TOKEN_REFRESH'
  | 'LOGOUT'
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'FORBIDDEN_ACCESS'
  | 'EMAIL_VERIFIED'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_SUCCESS'
  | 'GOOGLE_AUTH'
  | 'ROLE_CHANGED';

// Fields that should never appear in logs
const SENSITIVE_KEYS = ['email', 'password', 'token', 'refreshToken', 'idToken', 'code', 'otp'];

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEYS.includes(key)) continue;
    sanitized[key] = value;
  }
  return sanitized;
}

export function logSecurityEvent(event: SecurityEvent, details: Record<string, unknown>) {
  logger.info(`[SECURITY] ${event}`, sanitizeDetails(details));
}
