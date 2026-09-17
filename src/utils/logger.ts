type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel = 'info';
  private isStdio = false;

  constructor() {
    const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
    if (envLevel in LOG_LEVELS) {
      this.level = envLevel;
    }
  }

  public setStdioMode(stdio: boolean) {
    this.isStdio = stdio;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [tokopedia-mcp] ${message}`;
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      // In stdio mode, never write to stdout to avoid corrupting JSON-RPC messages
      console.error(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      console.error(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      console.error(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }
}

export const logger = new Logger();
