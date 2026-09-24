export const logger = {
  info(msg: string, fields?: Record<string, unknown>) {
    process.stdout.write(JSON.stringify({ level: 'info', time: new Date().toISOString(), msg, ...(fields || {}) }) + '\n');
  },
  warn(msg: string, fields?: Record<string, unknown>) {
    process.stderr.write(JSON.stringify({ level: 'warn', time: new Date().toISOString(), msg, ...(fields || {}) }) + '\n');
  },
  error(msg: string, fields?: Record<string, unknown>) {
    process.stderr.write(JSON.stringify({ level: 'error', time: new Date().toISOString(), msg, ...(fields || {}) }) + '\n');
  }
};
