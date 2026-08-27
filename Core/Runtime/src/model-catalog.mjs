import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './paths.mjs';

const catalogFile = path.join(CONFIG_DIR, 'OS', 'models.json');

export function loadModelCatalog() {
  if (!fs.existsSync(catalogFile)) return { updatedAt: null, models: [] };
  const data = JSON.parse(fs.readFileSync(catalogFile, 'utf8').replace(/^\uFEFF/, ''));
  return { updatedAt: data.updatedAt || null, models: Array.isArray(data.models) ? data.models : [] };
}

export function listModels() { return loadModelCatalog().models; }
export function findModel(id) { return listModels().find((model) => model.id === id || model.aliases?.includes(id)); }
