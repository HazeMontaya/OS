import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAuditLog } from '../src/audit.mjs';
import { createPolicy } from '../src/policy.mjs';
import { resolveInsideRoot, ROOT } from '../src/paths.mjs';
import { createMemoryStore } from '../src/memory.mjs';

test('path resolver blocks traversal outside root', () => {
  assert.throws(() => resolveInsideRoot('../outside.txt'), /escapes OS root/);
  assert.equal(resolveInsideRoot('Core').startsWith(ROOT), true);
});

test('policy requires approval for mutation', () => {
  const temp = path.join(os.tmpdir(), `os-audit-${process.pid}-${Date.now()}.jsonl`);
  const audit = createAuditLog(temp);
  const policy = createPolicy({ autonomy: { mode: 'supervised' }, policy: { allowWriteInsideRoot: true, allowShell: false, allowNetworkTools: true, requireApprovalForMutations: true, allowedShellCommands: [] } }, audit);
  assert.equal(policy.check('write', { approved: false }).allowed, false);
  assert.equal(policy.check('write', { approved: true }).allowed, true);
  assert.equal(policy.check('execute', { approved: true }).allowed, false);
  fs.rmSync(temp, { force: true });
});

test('memory store persists and searches records', () => {
  const temp = path.join(os.tmpdir(), `os-memory-${process.pid}-${Date.now()}.jsonl`);
  const memory = createMemoryStore(temp);
  memory.add({ text: 'Project Atlas deployment notes', tags: ['atlas'] });
  memory.add({ text: 'Unrelated record' });
  const hits = memory.search('atlas');
  assert.equal(hits.length, 1);
  assert.match(hits[0].text, /Atlas/);
  fs.rmSync(temp, { force: true });
});
