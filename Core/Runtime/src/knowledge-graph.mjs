import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.mjs';

const KG_DIR = path.join(ROOT, 'Data', 'KnowledgeGraph');
const ENTITIES_FILE = path.join(KG_DIR, 'entities.jsonl');
const RELATIONS_FILE = path.join(KG_DIR, 'relations.json');
const CONCEPTS_FILE = path.join(KG_DIR, 'concepts.json');

function ensure() { fs.mkdirSync(KG_DIR, { recursive: true }); }

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
}
function appendJsonl(file, entry) {
  ensure();
  fs.appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8');
}

export function addEntity(name, type, metadata = {}) {
  const entity = { id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: name.trim(), type, metadata, ts: new Date().toISOString() };
  appendJsonl(ENTITIES_FILE, entity);
  return entity;
}

export function addRelation(fromId, toId, type, weight = 1) {
  const relations = loadRelations();
  const existing = relations.find((r) => r.from === fromId && r.to === toId && r.type === type);
  if (existing) { existing.weight = Math.min(10, existing.weight + weight); existing.lastSeen = new Date().toISOString(); }
  else { relations.push({ from: fromId, to: toId, type, weight, created: new Date().toISOString(), lastSeen: new Date().toISOString() }); }
  fs.mkdirSync(KG_DIR, { recursive: true });
  fs.writeFileSync(RELATIONS_FILE, JSON.stringify(relations, null, 2), 'utf8');
  return relations;
}

export function loadRelations() {
  ensure();
  if (!fs.existsSync(RELATIONS_FILE)) return [];
  return JSON.parse(fs.readFileSync(RELATIONS_FILE, 'utf8'));
}

export function loadEntities() { return readJsonl(ENTITIES_FILE); }

export function searchEntities(query, limit = 20) {
  const q = query.toLowerCase();
  return loadEntities().filter((e) => e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q)).slice(0, limit);
}

export function getConnected(entityId, depth = 1) {
  const relations = loadRelations();
  const entities = loadEntities();
  const connected = new Set([entityId]);
  let frontier = [entityId];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const id of frontier) {
      for (const r of relations) {
        if (r.from === id && !connected.has(r.to)) { connected.add(r.to); next.push(r.to); }
        if (r.to === id && !connected.has(r.from)) { connected.add(r.from); next.push(r.from); }
      }
    }
    frontier = next;
  }
  return entities.filter((e) => connected.has(e.id));
}

export function addConcept(name, definition, tags = []) {
  const concepts = loadConcepts();
  const existing = concepts.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) { existing.definitions.push(definition); existing.tags = [...new Set([...existing.tags, ...tags])]; existing.updatedAt = new Date().toISOString(); }
  else { concepts.push({ name, definitions: [definition], tags, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); }
  fs.mkdirSync(KG_DIR, { recursive: true });
  fs.writeFileSync(CONCEPTS_FILE, JSON.stringify(concepts, null, 2), 'utf8');
  return concepts;
}

export function loadConcepts() {
  ensure();
  if (!fs.existsSync(CONCEPTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(CONCEPTS_FILE, 'utf8'));
}

export function searchConcepts(query, limit = 10) {
  const q = query.toLowerCase();
  return loadConcepts().filter((c) => c.name.toLowerCase().includes(q) || c.definitions.some((d) => d.toLowerCase().includes(q)) || c.tags.some((t) => t.toLowerCase().includes(q))).slice(0, limit);
}

export function buildKnowledgeGraphFromVault(vaultNotes) {
  const entities = [];
  const relations = [];
  for (const note of vaultNotes) {
    const entity = addEntity(note.path, 'note', { title: note.title || note.path, excerpt: (note.excerpt || '').substring(0, 200) });
    entities.push(entity);
    const links = note.body ? (note.body.match(/\[\[([^\]]+)\]\]/g) || []).map((l) => l.slice(2, -2)) : [];
    for (const link of links) {
      let target = entities.find((e) => e.name === link || e.metadata?.title === link);
      if (!target) { target = addEntity(link, 'concept', { linkedFrom: note.path }); entities.push(target); }
      relations.push({ from: entity.id, to: target.id, type: 'links-to', weight: 1 });
    }
    const tags = note.frontmatter?.tags || [];
    for (const tag of tags) {
      let tagEntity = entities.find((e) => e.name === tag && e.type === 'tag');
      if (!tagEntity) { tagEntity = addEntity(tag, 'tag', {}); entities.push(tagEntity); }
      relations.push({ from: entity.id, to: tagEntity.id, type: 'tagged-with', weight: 1 });
    }
  }
  return { entities: entities.length, relations: relations.length };
}

export function getKnowledgeStats() {
  const entities = loadEntities();
  const relations = loadRelations();
  const concepts = loadConcepts();
  const byType = {};
  for (const e of entities) { byType[e.type] = (byType[e.type] || 0) + 1; }
  return { entities: entities.length, relations: relations.length, concepts: concepts.length, byType };
}

export function getMostConnected(limit = 10) {
  const relations = loadRelations();
  const connections = {};
  for (const r of relations) { connections[r.from] = (connections[r.from] || 0) + 1; connections[r.to] = (connections[r.to] || 0) + 1; }
  const sorted = Object.entries(connections).sort((a, b) => b[1] - a[1]).slice(0, limit);
  const entities = loadEntities();
  return sorted.map(([id, count]) => { const e = entities.find((x) => x.id === id); return { entity: e?.name || id, count, type: e?.type }; });
}
