/**
 * Structured Logging — StashMind structured logs with request IDs.
 *
 * All log entries are JSON with correlation request IDs for traceability.
 * Log levels: info, warn, error, debug.
 */

import { Request, Response, NextFunction } from 'express';

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  durationMs?: number;
  error?: string;
  [key: string]: unknown;
}

let logLevel: LogLevel = 'info';
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function setLogLevel(level: LogLevel): void {
  logLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[logLevel];
}

function log(level: LogLevel, message: string, meta: Partial<LogEntry> = {}): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  // Redact sensitive fields
  if (entry.headers) {
    entry.headers = { ...(entry.headers as Record<string, unknown>), authorization: '[REDACTED]' };
  }

  console.log(JSON.stringify(entry));
}

export function debug(message: string, meta?: LogEntry): void {
  log('debug', message, meta);
}

export function info(message: string, meta?: LogEntry): void {
  log('info', message, meta);
}

export function warn(message: string, meta?: LogEntry): void {
  log('warn', message, meta);
}

export function error(message: string, meta?: LogEntry): void {
  log('error', message, meta);
}

/**
 * Express middleware for structured request logging with correlation IDs.
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  const requestId = (req as unknown as { requestId?: string }).requestId || `req_${Date.now()}`;
  const userId = (req as unknown as { userId?: string }).userId;

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    log(level, `${req.method} ${req.url}`, {
      requestId,
      userId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      durationMs,
    } as Partial<LogEntry>);
  });

  next();
}
