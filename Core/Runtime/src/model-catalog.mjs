import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './paths.mjs';

const catalogPath = path.join(CONFIG_DIR, 'models.json');

export function listModels() {
  if (!fs.existsSync(catalogPath)) return [];
  const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const models = Array.isArray(raw) ? raw : Array.isArray(raw.models) ? raw.models : [];
  return models.filter((model) => model && model.id).map((model) => ({
    id: String(model.id),
    name: String(model.name || model.id),
    provider: String(model.provider || 'local'),
    selectable: model.selectable !== false,
    capabilities: Array.isArray(model.capabilities) ? model.capabilities.map(String) : Array.isArray(model.roles) ? model.roles.map(String) : [],
    contextWindow: Number(model.contextWindow || model.contextTokens || 0) || null,
    notes: model.notes ? String(model.notes) : null
  }));
}

export function findModel(id) {
  return listModels().find((model) => model.id === id) || null;
}

export function firstModelForProvider(providerId) {
  return listModels().find((model) => model.provider === providerId && model.selectable !== false) || null;
}
