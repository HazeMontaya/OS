import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { loadConfig } from './config.mjs';
import { UI_DIR, ROOT } from './paths.mjs';
import { createToolRegistry } from './tools.mjs';
import { createProviders } from './providers.mjs';
import { addMemory, searchMemory } from './memory.mjs';
import { createWorkflowEngine } from './workflows.mjs';
import { createAutomationEngine } from './automations.mjs';
import { createMcpManager } from './mcp.mjs';
import { createAgent } from './agent.mjs';
import { log } from './logger.mjs';

const config = loadConfig();
const tools = createToolRegistry(config);
const providers = createProviders(config);
const mcp = createMcpManager();
const workflows = createWorkflowEngine({ tools, providers });
const automations = createAutomationEngine(workflows);
const agent = createAgent({ tools, providers, config });

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; if (data.length > 2_000_000) reject(new Error('Request too large')); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const route = req.url === '/' ? '/index.html' : req.url;
  const clean = path.normalize(route).replace(/^(\.\.[/\\])+/, '');
  const target = path.join(UI_DIR, clean);
  if (!target.startsWith(UI_DIR) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) return false;
  const ext = path.extname(target);
  const contentType = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': `${contentType}; charset=utf-8` });
  fs.createReadStream(target).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, {
        ok: true,
        version: '0.7.0',
        root: ROOT,
        providers: await providers.status(),
        tools: tools.list().length,
        workflows: workflows.list().length,
        automations: automations.list().length,
        mcp: mcp.registry().servers.length
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/tools') return json(res, 200, tools.list());
    if (req.method === 'POST' && url.pathname === '/api/tool') {
      const input = await body(req);
      return json(res, 200, { result: await tools.execute(input.tool, input.args || {}) });
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') return json(res, 200, await agent.run(await body(req)));
    if (req.method === 'GET' && url.pathname === '/api/memory') return json(res, 200, searchMemory(url.searchParams.get('q') || '', Number(url.searchParams.get('limit') || 100)));
    if (req.method === 'POST' && url.pathname === '/api/memory') return json(res, 201, addMemory(await body(req)));
    if (req.method === 'GET' && url.pathname === '/api/workflows') return json(res, 200, workflows.list());
    if (req.method === 'POST' && url.pathname === '/api/workflows/run') {
      const input = await body(req);
      return json(res, 200, await workflows.run(input.id, input.input || {}));
    }
    if (req.method === 'GET' && url.pathname === '/api/automations') return json(res, 200, automations.list());
    if (req.method === 'POST' && url.pathname === '/api/automations/run') {
      const input = await body(req);
      return json(res, 200, await automations.run(input.id));
    }
    if (req.method === 'GET' && url.pathname === '/api/mcp') return json(res, 200, mcp.registry());
    if (req.method === 'POST' && url.pathname === '/api/mcp/discover') {
      const discovered = await mcp.discoverTools();
      for (const item of discovered) {
        if (!item.name || item.error) continue;
        const toolName = `mcp.${item.server}.${item.name}`;
        tools.register({
          name: toolName,
          description: item.description || `MCP tool ${item.name} on ${item.server}`,
          mutating: true,
          execute: (args = {}) => mcp.callTool(item.server, item.name, args)
        });
      }
      return json(res, 200, discovered);
    }
    if (req.method === 'POST' && url.pathname === '/api/mcp/call') {
      const input = await body(req);
      return json(res, 200, await mcp.callTool(input.server, input.tool, input.args || {}));
    }
    if (req.method === 'GET' && serveStatic(req, res)) return;
    json(res, 404, { error: 'Not found' });
  } catch (error) {
    log('error', 'request.failed', { method: req.method, url: req.url, error: error.message });
    json(res, 500, { error: error.message });
  }
});

const automationCount = automations.start();
server.listen(config.port, config.host, () => {
  const url = `http://${config.host}:${config.port}`;
  log('info', 'runtime.started', { url, automationCount });
  console.log(`OS runtime 0.7.0 running at ${url}`);
  if (config.openBrowser && process.env.OS_NO_BROWSER !== '1') {
    if (process.platform === 'win32') exec(`start "" "${url}"`);
    else if (process.platform === 'darwin') exec(`open "${url}"`);
    else exec(`xdg-open "${url}"`);
  }
});

function shutdown() {
  automations.stop();
  mcp.stop();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
