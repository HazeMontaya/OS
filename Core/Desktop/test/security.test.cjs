const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.cjs'), 'utf8');

test('Electron renderer is isolated from Node', () => {
  assert.match(source, /contextIsolation:\s*true/);
  assert.match(source, /nodeIntegration:\s*false/);
  assert.match(source, /sandbox:\s*true/);
  assert.match(source, /webSecurity:\s*true/);
});

test('Electron blocks permissions and uncontrolled navigation', () => {
  assert.match(source, /setPermissionRequestHandler/);
  assert.match(source, /setPermissionCheckHandler/);
  assert.match(source, /setWindowOpenHandler/);
  assert.match(source, /will-navigate/);
  assert.match(source, /will-attach-webview/);
});
