import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { loadConfig } from './config.mjs';

function loadEnv() {
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(process.env.USERPROFILE || '', '.env'),
    'S:/OS/Core/Runtime/.env'
  ];
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 1) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
      break;
    }
  }
}
loadEnv();
import { UI_DIR, ROOT } from './paths.mjs';
import { createToolRegistry } from './tools.mjs';
import { createProviders } from './providers.mjs';
import { addMemory, searchMemory } from './memory.mjs';
import { createWorkflowEngine } from './workflows.mjs';
import { createAutomationEngine } from './automations.mjs';
import { createMcpManager } from './mcp.mjs';
import { createAgent } from './agent.mjs';
import { listModels } from './model-catalog.mjs';
import { log } from './logger.mjs';
import { vaultRead, vaultWrite, vaultList, vaultSearch, vaultLinks, vaultBacklinks, vaultUpdateIndex, vaultReadAll } from './vault.mjs';
import { getEvolutionState, getEvolutionLog, analyzeCode, findImprovements, generateEvolutionReport } from './evolution.mjs';
import { addEntity, addRelation, addConcept, searchEntities, searchConcepts, getKnowledgeStats, getMostConnected } from './knowledge-graph.mjs';
import { fullInspection, securityAudit, inspectRuntime } from './self-inspect.mjs';
const VERSION = '0.9.0';
const config = loadConfig();
const port = Number(process.env.OS_PORT || config.port);
const host = process.env.OS_HOST || config.host;
const tools = createToolRegistry(config);
const providers = createProviders(config);
const mcp = createMcpManager();
const workflows = createWorkflowEngine({ tools, providers });
const automations = createAutomationEngine(workflows);
const agent = createAgent({ tools, providers, config });
function json(res, status, value) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); }
function body(req) { return new Promise((resolve, reject) => { let data = ''; req.on('data', (chunk) => { data += chunk; if (data.length > 2_000_000) reject(new Error('Request too large')); }); req.on('end', () => { if (!data) return resolve({}); try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } }); req.on('error', reject); }); }
function serveStatic(req, res) {
  const rawPath = new URL(req.url, 'http://localhost').pathname;
  const route = rawPath === '/' ? '/index.html' : rawPath;
  const clean = path.normalize(route).replace(/^(\.\.[/\\])+/, '');
  const target = path.join(UI_DIR, clean);
  if (!target.startsWith(UI_DIR) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) return false;
  const ext = path.extname(target);
  const contentType = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': `${contentType}; charset=utf-8`, 'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=300' });
  fs.createReadStream(target).pipe(res); return true;
}
export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/api/health') { const evo = getEvolutionState(); const kg = getKnowledgeStats(); return json(res, 200, { ok: true, version: VERSION, root: ROOT, providers: await providers.status(), models: listModels().length, tools: tools.list().length, workflows: workflows.list().length, automations: automations.list().length, mcp: mcp.registry().servers.length, vault: vaultReadAll(1000).length, evolution: { version: evo.version, interactions: evo.metrics.totalInteractions, selfMods: evo.metrics.selfModifications, skills: evo.skills.length }, knowledge: kg }); }
    if (req.method === 'GET' && url.pathname === '/api/models') return json(res, 200, listModels());
    if (req.method === 'GET' && url.pathname === '/api/tools') return json(res, 200, tools.list());
    if (req.method === 'POST' && url.pathname === '/api/tool') { const input = await body(req); return json(res, 200, { result: await tools.execute(input.tool, input.args || {}) }); }
    if (req.method === 'POST' && url.pathname === '/api/chat') return json(res, 200, await agent.run(await body(req)));
    if (req.method === 'GET' && url.pathname === '/api/memory') return json(res, 200, searchMemory(url.searchParams.get('q') || '', Number(url.searchParams.get('limit') || 100)));
    if (req.method === 'POST' && url.pathname === '/api/memory') return json(res, 201, addMemory(await body(req)));
    if (req.method === 'GET' && url.pathname === '/api/workflows') return json(res, 200, workflows.list());
    if (req.method === 'POST' && url.pathname === '/api/workflows/run') { const input = await body(req); return json(res, 200, await workflows.run(input.id, input.input || {})); }
    if (req.method === 'GET' && url.pathname === '/api/automations') return json(res, 200, automations.list());
    if (req.method === 'POST' && url.pathname === '/api/automations/run') { const input = await body(req); return json(res, 200, await automations.run(input.id)); }
    if (req.method === 'GET' && url.pathname === '/api/mcp') return json(res, 200, mcp.registry());
    if (req.method === 'POST' && url.pathname === '/api/mcp/discover') {
      const discovered = await mcp.discoverTools();
      for (const item of discovered) { if (!item.name || item.error) continue; const toolName = `mcp.${item.server}.${item.name}`; tools.register({ name: toolName, description: item.description || `MCP tool ${item.name} on ${item.server}`, mutating: true, execute: (args = {}) => mcp.callTool(item.server, item.name, args) }); }
      return json(res, 200, discovered);
    }
    if (req.method === 'POST' && url.pathname === '/api/mcp/call') { const input = await body(req); return json(res, 200, await mcp.callTool(input.server, input.tool, input.args || {})); }
    if (req.method === 'GET' && url.pathname === '/api/vault') return json(res, 200, { dir: 'AI-Brain', notes: vaultReadAll(100) });
    if (req.method === 'GET' && url.pathname === '/api/vault/list') return json(res, 200, vaultList(url.searchParams.get('path') || '.'));
    if (req.method === 'GET' && url.pathname === '/api/vault/read') { const p = url.searchParams.get('path'); if (!p) return json(res, 400, { error: 'path required' }); const note = vaultRead(p); if (!note) return json(res, 404, { error: 'Note not found' }); return json(res, 200, note); }
    if (req.method === 'GET' && url.pathname === '/api/vault/search') { const q = url.searchParams.get('q'); if (!q) return json(res, 400, { error: 'q required' }); return json(res, 200, vaultSearch(q, url.searchParams.get('folder') || '.', Number(url.searchParams.get('limit') || 20))); }
    if (req.method === 'GET' && url.pathname === '/api/vault/links') { const p = url.searchParams.get('path'); if (!p) return json(res, 400, { error: 'path required' }); return json(res, 200, vaultLinks(p)); }
    if (req.method === 'GET' && url.pathname === '/api/vault/backlinks') { const p = url.searchParams.get('path'); if (!p) return json(res, 400, { error: 'path required' }); return json(res, 200, vaultBacklinks(p)); }
    if (req.method === 'POST' && url.pathname === '/api/vault/write') { const input = await body(req); if (!input.path) return json(res, 400, { error: 'path required' }); return json(res, 200, vaultWrite(input.path, input.content || '', input.frontmatter || {})); }
    if (req.method === 'POST' && url.pathname === '/api/vault/index') return json(res, 200, vaultUpdateIndex());
    if (req.method === 'GET' && url.pathname === '/api/evolution') return json(res, 200, getEvolutionState());
    if (req.method === 'GET' && url.pathname === '/api/evolution/report') return json(res, 200, generateEvolutionReport());
    if (req.method === 'GET' && url.pathname === '/api/evolution/log') return json(res, 200, getEvolutionLog(Number(url.searchParams.get('limit') || 50)));
    if (req.method === 'GET' && url.pathname === '/api/evolution/analysis') return json(res, 200, analyzeCode());
    if (req.method === 'GET' && url.pathname === '/api/evolution/improvements') return json(res, 200, findImprovements());
    if (req.method === 'GET' && url.pathname === '/api/knowledge') return json(res, 200, getKnowledgeStats());
    if (req.method === 'GET' && url.pathname === '/api/knowledge/entities') return json(res, 200, searchEntities(url.searchParams.get('q') || '', Number(url.searchParams.get('limit') || 20)));
    if (req.method === 'GET' && url.pathname === '/api/knowledge/concepts') return json(res, 200, searchConcepts(url.searchParams.get('q') || '', Number(url.searchParams.get('limit') || 20)));
    if (req.method === 'GET' && url.pathname === '/api/knowledge/connected') return json(res, 200, getMostConnected(Number(url.searchParams.get('limit') || 10)));
    if (req.method === 'POST' && url.pathname === '/api/knowledge/entity') { const input = await body(req); return json(res, 201, addEntity(input.name, input.type, input.metadata || {})); }
    if (req.method === 'POST' && url.pathname === '/api/knowledge/concept') { const input = await body(req); return json(res, 201, addConcept(input.name, input.definition, input.tags || [])); }
    if (req.method === 'GET' && url.pathname === '/api/inspect') return json(res, 200, fullInspection());
    if (req.method === 'GET' && url.pathname === '/api/inspect/security') return json(res, 200, securityAudit());
    if (req.method === 'GET' && url.pathname === '/api/inspect/runtime') return json(res, 200, inspectRuntime());
    if (req.method === 'GET' && serveStatic(req, res)) return;
    return json(res, 404, { error: 'Not found' });
  } catch (error) { log('error', 'request.failed', { method: req.method, url: req.url, error: error.message }); return json(res, 500, { error: error.message }); }
});
const automationCount = automations.start();
server.listen(port, host, () => {
  const url = `http://${host}:${port}`;
  log('info', 'runtime.started', { url, version: VERSION, automationCount });
  console.log(`OS runtime ${VERSION} running at ${url}`);
  if (config.openBrowser && process.env.OS_NO_BROWSER !== '1') { if (process.platform === 'win32') exec(`start "" "${url}"`); else if (process.platform === 'darwin') exec(`open "${url}"`); else exec(`xdg-open "${url}"`); }
});
function shutdown() { automations.stop(); mcp.stop(); server.close(() => process.exit(0)); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
