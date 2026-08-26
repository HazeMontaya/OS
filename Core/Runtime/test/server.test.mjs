import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const port = 45000 + (process.pid % 1000);
const base = `http://127.0.0.1:${port}`;
let child;

async function waitForHealth() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try { const response = await fetch(`${base}/api/health`); if (response.ok) return response.json(); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('runtime did not start');
}

test.before(async () => {
  child = spawn(process.execPath, [path.join(root, 'Core', 'Runtime', 'src', 'server.mjs')], { cwd: root, env: { ...process.env, OS_PORT: String(port), OS_HOST: '127.0.0.1', OS_NO_BROWSER: '1', OS_LOG_LEVEL: 'error' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await waitForHealth();
});

test.after(() => { child?.kill(); fs.rmSync(path.join(root, 'Data', 'Runtime', 'ci-write.txt'), { force: true }); });

test('health endpoint exposes kernel state and security headers', async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy') || '', /default-src 'self'/);
  const health = await response.json();
  assert.equal(health.ok, true);
  assert.equal(health.version, '1.0.0');
  assert.equal(health.policy.requireApprovalForMutations, true);
});

test('mutating tool is blocked until explicitly approved', async () => {
  const payload = { tool: 'fs.write', args: { path: 'Data/Runtime/ci-write.txt', content: 'ok' } };
  const blocked = await fetch(`${base}/api/tool`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(blocked.status, 409);
  const body = await blocked.json();
  assert.equal(body.code, 'APPROVAL_REQUIRED');
  const allowed = await fetch(`${base}/api/tool`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, approved: true }) });
  assert.equal(allowed.status, 200);
  assert.equal(fs.readFileSync(path.join(root, 'Data', 'Runtime', 'ci-write.txt'), 'utf8'), 'ok');
});

test('renderer cannot post from an arbitrary web origin', async () => {
  const response = await fetch(`${base}/api/memory`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://example.com' }, body: JSON.stringify({ text: 'blocked' }) });
  assert.equal(response.status, 403);
});
