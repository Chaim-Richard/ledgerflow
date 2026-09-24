export const logger = {
  info(msg: string, fields?: Record<string, unknown>) {
    console.log(JSON.stringify({ level: 'info', time: new Date().toISOString(), msg, ...(fields || {}) }));
  },
  warn(msg: string, fields?: Record<string, unknown>) {
    console.warn(JSON.stringify({ level: 'warn', time: new Date().toISOString(), msg, ...(fields || {}) }));
  },
  error(msg: string, fields?: Record<string, unknown>) {
    console.error(JSON.stringify({ level: 'error', time: new Date().toISOString(), msg, ...(fields || {}) }));
  }
};
