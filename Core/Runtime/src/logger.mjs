import fs from 'node:fs';
import path from 'node:path';
import { LOG_DIR } from './paths.mjs';

fs.mkdirSync(LOG_DIR, { recursive: true });
const logFile = path.join(LOG_DIR, 'os-runtime.jsonl');

export function log(level, event, data = {}) {
  const entry = { ts: new Date().toISOString(), level, event, ...data };
  fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`, 'utf8');
  return entry;
}
