import fs from 'node:fs';
import crypto from 'node:crypto';
import { AUDIT_FILE } from './paths.mjs';

export function createAuditLog(file = AUDIT_FILE) {
  function append(action, details = {}) {
    const record = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      action,
      ...details
    };
    fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }

  function list(limit = 100) {
    if (!fs.existsSync(file)) return [];
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    return lines.slice(-Math.max(1, Math.min(Number(limit) || 100, 500))).reverse().map((line) => {
      try { return JSON.parse(line); } catch { return { malformed: true, raw: line }; }
    });
  }

  return { append, list };
}
