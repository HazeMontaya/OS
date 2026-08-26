const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'main.cjs'), 'utf8');
test('desktop shell uses isolated renderer and sandbox', () => { assert.match(source, /contextIsolation:\s*true/); assert.match(source, /nodeIntegration:\s*false/); assert.match(source, /sandbox:\s*true/); });
test('desktop shell embeds runtime through Electron Node mode', () => { assert.match(source, /ELECTRON_RUN_AS_NODE/); assert.match(source, /OS_ROOT/); assert.match(source, /OS_NO_BROWSER/); });
test('desktop shell blocks renderer permission requests', () => assert.match(source, /setPermissionRequestHandler/));
