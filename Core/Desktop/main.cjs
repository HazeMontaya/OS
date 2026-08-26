const { app, BrowserWindow, session, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.OS_PORT || 43110);
const ORIGIN = `http://${HOST}:${PORT}`;
let runtime = null;
let mainWindow = null;
let quitting = false;

function osRoot() {
  if (process.env.OS_ROOT) return path.resolve(process.env.OS_ROOT);
  const portable = path.dirname(process.execPath);
  if (fs.existsSync(path.join(portable, 'Core', 'Runtime', 'src', 'server.mjs'))) return portable;
  return path.resolve(__dirname, '..', '..');
}

function log(message) {
  const dir = path.join(osRoot(), 'Logs');
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'desktop.log'), `[${new Date().toISOString()}] ${message}\n`, 'utf8');
}

function startRuntime() {
  const root = osRoot();
  const script = path.join(root, 'Core', 'Runtime', 'src', 'server.mjs');
  if (!fs.existsSync(script)) throw new Error(`Runtime missing: ${script}`);
  runtime = spawn(process.execPath, [script], {
    cwd: root,
    windowsHide: true,
    shell: false,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', OS_ROOT: root, OS_NO_BROWSER: '1', OS_HOST: HOST, OS_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  runtime.stdout?.on('data', (chunk) => log(`runtime: ${chunk.toString().trim()}`));
  runtime.stderr?.on('data', (chunk) => log(`runtime-error: ${chunk.toString().trim()}`));
  runtime.on('exit', (code, signal) => {
    log(`runtime exited code=${code} signal=${signal}`);
    runtime = null;
    if (!quitting && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send?.('runtime-exited');
  });
}

async function waitForRuntime(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (runtime?.exitCode != null) throw new Error(`Runtime exited before ready (${runtime.exitCode})`);
    try { const response = await fetch(`${ORIGIN}/api/health`, { cache: 'no-store' }); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('OS runtime did not become ready');
}

function isAllowedNavigation(url) { try { return new URL(url).origin === ORIGIN; } catch { return false; } }

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1540, height: 980, minWidth: 900, minHeight: 640, show: false, backgroundColor: '#071018', autoHideMenuBar: true, title: 'OS',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, devTools: process.env.OS_DEVTOOLS === '1', spellcheck: false }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//i.test(url)) shell.openExternal(url).catch(() => {}); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!isAllowedNavigation(url)) event.preventDefault(); });
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
  mainWindow.once('ready-to-show', () => mainWindow.show());
  await mainWindow.loadURL(ORIGIN);
}

function hardenSession() {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.resourceType === 'mainFrame' && !isAllowedNavigation(details.url)) { callback({ cancel: true }); return; }
    callback({ cancel: false });
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (!mainWindow) return; if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); });
  app.whenReady().then(async () => {
    hardenSession();
    try { startRuntime(); await waitForRuntime(); await createWindow(); }
    catch (error) { log(error.stack || error.message); app.quit(); }
  });
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { quitting = true; if (runtime && !runtime.killed) runtime.kill(); });
