export const logger = {
  info: (msg: string, meta?: object) => console.log(JSON.stringify({ level: 'info', msg, ...meta, ts: Date.now() })),
  error: (msg: string, error?: unknown, meta?: object) => console.error(JSON.stringify({ level: 'error', msg, error: String(error), ...meta, ts: Date.now() })),
  warn: (msg: string, meta?: object) => console.warn(JSON.stringify({ level: 'warn', msg, ...meta, ts: Date.now() })),
};
