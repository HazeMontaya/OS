import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadConfig } from './config.mjs';
import { UI_DIR, ROOT } from './paths.mjs';
import { createKernel } from './kernel.mjs';
import { log } from './logger.mjs';

const config = loadConfig();
const kernel = createKernel(config);
const host = config.host;
const port = Number(config.port);
const bodyLimit = Number(config.requestBodyLimitBytes || 2_097_152);

function securityHeaders(res, contentType = 'application/json; charset=utf-8') {
  res.setHeader('content-type', contentType);
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('cross-origin-resource-policy', 'same-origin');
  res.setHeader('content-security-policy', "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; style-src-attr 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
}

function json(res, status, value) {
  securityHeaders(res);
  res.statusCode = status;
  res.end(JSON.stringify(value));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > bodyLimit) {
        const error = new Error('Request body too large');
        error.code = 'BODY_TOO_LARGE';
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { code: 'INVALID_JSON' })); }
    });
    req.on('error', reject);
  });
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) && Number(parsed.port || port) === port;
  } catch {
    return false;
  }
}

function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, `http://${host}:${port}`).pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(UI_DIR, relative);
  const rel = path.relative(UI_DIR, target);
  if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(target) || !fs.statSync(target).isFile()) return false;

  const ext = path.extname(target).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
  };
  securityHeaders(res, types[ext] || 'application/octet-stream');
  res.setHeader('cache-control', ext === '.html' ? 'no-store' : 'public, max-age=300');
  res.statusCode = 200;
  fs.createReadStream(target).pipe(res);
  return true;
}

function openLocalUrl(url) {
  if (process.env.OS_NO_BROWSER === '1') return;
  const commands = process.platform === 'win32'
    ? [['cmd', ['/c', 'start', '', url]]]
    : process.platform === 'darwin'
      ? [['open', [url]]]
      : [['xdg-open', [url]]];
  const [command, args] = commands[0];
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

function statusFor(error) {
  if (error.code === 'APPROVAL_REQUIRED') return 409;
  if (error.code === 'POLICY_DENIED') return 403;
  if (error.code === 'INVALID_JSON') return 400;
  if (error.code === 'BODY_TOO_LARGE') return 413;
  return 500;
}

export const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  try {
    if (!isAllowedOrigin(req) && req.method !== 'GET' && req.method !== 'HEAD') {
      return json(res, 403, { error: 'Origin not allowed', requestId });
    }

    const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);
    const pathname = url.pathname;

    if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ...(await kernel.health()), root: ROOT });
    if (req.method === 'GET' && pathname === '/api/models') return json(res, 200, kernel.models.list());
    if (req.method === 'GET' && pathname === '/api/tools') return json(res, 200, kernel.tools.list());
    if (req.method === 'GET' && pathname === '/api/audit') return json(res, 200, kernel.audit.list(url.searchParams.get('limit')));
    if (req.method === 'GET' && pathname === '/api/events') return json(res, 200, kernel.events.recent(url.searchParams.get('limit')));

    if (req.method === 'POST' && pathname === '/api/tool') {
      const input = await readBody(req);
      const result = await kernel.tools.execute(input.tool, input.args || {}, { approved: input.approved === true, subject: 'api' });
      return json(res, 200, { result });
    }

    if (req.method === 'POST' && pathname === '/api/chat') {
      return json(res, 200, await kernel.agent.run(await readBody(req)));
    }

    if (req.method === 'GET' && pathname === '/api/memory') {
      return json(res, 200, kernel.memory.search(url.searchParams.get('q') || '', url.searchParams.get('limit') || 100));
    }

    if (req.method === 'POST' && pathname === '/api/memory') {
      kernel.policy.enforce('write', { approved: true, subject: 'memory:add' });
      return json(res, 201, kernel.memory.add(await readBody(req)));
    }

    if (req.method === 'GET' && pathname === '/api/workflows') return json(res, 200, kernel.workflows.list());
    if (req.method === 'POST' && pathname === '/api/workflows/run') {
      const input = await readBody(req);
      return json(res, 200, await kernel.workflows.run(input.id, input.input || {}, { approved: input.approved === true, subject: 'workflow' }));
    }

    if (req.method === 'GET' && pathname === '/api/automations') return json(res, 200, kernel.automations.list());
    if (req.method === 'POST' && pathname === '/api/automations/run') {
      const input = await readBody(req);
      return json(res, 200, await kernel.automations.run(input.id, { approved: input.approved === true, subject: 'automation' }));
    }

    if (req.method === 'GET' && pathname === '/api/mcp') return json(res, 200, kernel.mcp.registry());
    if (req.method === 'POST' && pathname === '/api/mcp/discover') {
      const input = await readBody(req);
      kernel.policy.enforce('admin', { approved: input.approved === true, subject: 'mcp:discover' });
      const discovered = await kernel.mcp.discoverTools();
      for (const item of discovered) {
        if (!item.name || item.error) continue;
        kernel.tools.register({
          name: `mcp.${item.server}.${item.name}`,
          description: item.description || `MCP tool ${item.name}`,
          capability: 'admin',
          mutating: true,
          execute: (args = {}) => kernel.mcp.callTool(item.server, item.name, args)
        });
      }
      return json(res, 200, discovered);
    }

    if (req.method === 'POST' && pathname === '/api/mcp/call') {
      const input = await readBody(req);
      kernel.policy.enforce('admin', { approved: input.approved === true, subject: `mcp:${input.server}:${input.tool}` });
      return json(res, 200, await kernel.mcp.callTool(input.server, input.tool, input.args || {}));
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(req, res)) return;
    return json(res, 404, { error: 'Not found', requestId });
  } catch (error) {
    log('error', 'request.failed', { requestId, method: req.method, url: req.url, error: error.message, code: error.code || null });
    return json(res, statusFor(error), { error: error.message, code: error.code || 'INTERNAL_ERROR', requestId });
  } finally {
    log('debug', 'request.completed', { requestId, method: req.method, url: req.url, durationMs: Date.now() - started });
  }
});

const automationCount = kernel.start();
server.listen(port, host, () => {
  const url = `http://${host}:${port}`;
  log('info', 'runtime.started', { url, version: '1.0.0', automationCount });
  console.log(`OS 1.0.0 runtime: ${url}`);
  if (config.openBrowser) openLocalUrl(url);
});

function shutdown(signal) {
  log('info', 'runtime.stopping', { signal });
  kernel.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
