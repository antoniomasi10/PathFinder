import { logger } from './logger';

type SecurityEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'REGISTER'
  | 'TOKEN_REFRESH'
  | 'LOGOUT'
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'FORBIDDEN_ACCESS';

export function logSecurityEvent(event: SecurityEvent, details: Record<string, unknown>) {
  logger.info(`[SECURITY] ${event}`, details as Record<string, unknown>);
}
