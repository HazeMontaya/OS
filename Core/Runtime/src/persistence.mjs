import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.mjs';
import { emit } from './events.mjs';

const DATA_DIR = path.join(ROOT, 'Data');
const COLLECTIONS_DIR = path.join(DATA_DIR, 'Collections');
const MIGRATIONS_FILE = path.join(DATA_DIR, 'migrations.json');
const SCHEMA_VERSION = 1;

function ensure() { fs.mkdirSync(COLLECTIONS_DIR, { recursive: true }); }

function getCollectionPath(name) {
  return path.join(COLLECTIONS_DIR, `${name}.json`);
}

function readCollection(name) {
  const fp = getCollectionPath(name);
  if (!fs.existsSync(fp)) return [];
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return []; }
}

function writeCollection(name, data) {
  ensure();
  const fp = getCollectionPath(name);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
}

export function insert(collection, record) {
  const data = readCollection(collection);
  const entry = {
    _id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _created: new Date().toISOString(),
    _updated: new Date().toISOString(),
    ...record,
  };
  data.push(entry);
  writeCollection(collection, data);
  emit('persistence.inserted', { collection, id: entry._id });
  return entry;
}

export function find(collection, query = {}) {
  const data = readCollection(collection);
  return data.filter((item) => {
    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith('_')) continue;
      if (typeof value === 'object' && value !== null) {
        if (value.$regex && !new RegExp(value.$regex, value.$options || '').test(item[key] || '')) return false;
        if (value.$gt && !(item[key] > value.$gt)) return false;
        if (value.$lt && !(item[key] < value.$lt)) return false;
        if (value.$in && !value.$in.includes(item[key])) return false;
      } else {
        if (item[key] !== value) return false;
      }
    }
    return true;
  });
}

export function findOne(collection, query = {}) {
  return find(collection, query)[0] || null;
}

export function update(collection, query, updates) {
  const data = readCollection(collection);
  let count = 0;
  for (const item of data) {
    let match = true;
    for (const [key, value] of Object.entries(query)) {
      if (item[key] !== value) { match = false; break; }
    }
    if (match) {
      Object.assign(item, updates, { _updated: new Date().toISOString() });
      count++;
    }
  }
  if (count > 0) writeCollection(collection, data);
  emit('persistence.updated', { collection, count });
  return count;
}

export function remove(collection, query) {
  const data = readCollection(collection);
  const filtered = data.filter((item) => {
    for (const [key, value] of Object.entries(query)) {
      if (item[key] !== value) return true;
    }
    return false;
  });
  const removed = data.length - filtered.length;
  if (removed > 0) writeCollection(collection, filtered);
  emit('persistence.removed', { collection, count: removed });
  return removed;
}

export function count(collection, query = {}) {
  return find(collection, query).length;
}

export function listCollections() {
  ensure();
  return fs.readdirSync(COLLECTIONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const name = f.replace('.json', '');
      const data = readCollection(name);
      return { name, count: data.length, size: fs.statSync(getCollectionPath(name)).size };
    });
}

export function getSchemaVersion() {
  ensure();
  if (!fs.existsSync(MIGRATIONS_FILE)) return { version: SCHEMA_VERSION, migrations: [] };
  return JSON.parse(fs.readFileSync(MIGRATIONS_FILE, 'utf8'));
}

export function saveMigration(name, up) {
  const state = getSchemaVersion();
  state.migrations.push({ name, applied: new Date().toISOString() });
  state.version = SCHEMA_VERSION;
  ensure();
  fs.writeFileSync(MIGRATIONS_FILE, JSON.stringify(state, null, 2), 'utf8');
  emit('persistence.migrated', { name });
  return state;
}

export function getStats() {
  const collections = listCollections();
  let totalRecords = 0;
  let totalSize = 0;
  for (const c of collections) { totalRecords += c.count; totalSize += c.size; }
  return { collections: collections.length, totalRecords, totalSize, schemaVersion: SCHEMA_VERSION };
}

export function upsert(collection, query, record) {
  const existing = findOne(collection, query);
  if (existing) {
    update(collection, query, record);
    return findOne(collection, query);
  }
  return insert(collection, { ...query, ...record });
}
