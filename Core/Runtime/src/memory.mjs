import fs from 'node:fs';
import crypto from 'node:crypto';
import { MEMORY_FILE } from './paths.mjs';

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFKD');
}

export function createMemoryStore(file = MEMORY_FILE) {
  function readAll() {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
  }

  function add(input = {}) {
    const text = String(input.text || '').trim();
    if (!text) throw new Error('text is required');
    const record = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      type: String(input.type || 'semantic'),
      source: String(input.source || 'manual'),
      tags: Array.isArray(input.tags) ? input.tags.map(String).slice(0, 32) : [],
      text: text.slice(0, 100_000),
      metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
    };
    fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }

  function search(query = '', limit = 50) {
    const items = readAll();
    const needle = normalize(query).trim();
    const cap = Math.min(Math.max(Number(limit) || 50, 1), 500);
    if (!needle) return items.slice(-cap).reverse();
    const terms = needle.split(/\s+/).filter(Boolean);
    return items
      .map((item) => {
        const haystack = normalize(`${item.text} ${(item.tags || []).join(' ')} ${JSON.stringify(item.metadata || {})}`);
        const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || String(b.item.ts).localeCompare(String(a.item.ts)))
      .slice(0, cap)
      .map((entry) => entry.item);
  }

  return { add, search, count: () => readAll().length };
}
