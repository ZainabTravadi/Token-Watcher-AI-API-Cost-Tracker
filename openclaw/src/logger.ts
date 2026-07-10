import type { LogLevel } from "./config/env";

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export interface Logger {
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

function emit(level: LogLevel, threshold: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  if (priorities[level] < priorities[threshold]) {
    return;
  }

  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    ...fields
  });

  if (level === "error") {
    process.stderr.write(`${line}\n`);
    return;
  }

  process.stdout.write(`${line}\n`);
}

export function createLogger(level: LogLevel): Logger {
  return {
    debug: (event, fields) => emit("debug", level, event, fields),
    info: (event, fields) => emit("info", level, event, fields),
    warn: (event, fields) => emit("warn", level, event, fields),
    error: (event, fields) => emit("error", level, event, fields)
  };
}
