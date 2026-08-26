const { app, BrowserWindow, session, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.OS_PORT || 43110);
const ORIGIN = `http://${HOST}:${PORT}`;
let runtime = null;
let mainWindow = null;

function osRoot() { return path.dirname(process.execPath); }
function logFile() { const dir = path.join(osRoot(), 'Logs'); fs.mkdirSync(dir, { recursive: true }); return path.join(dir, 'desktop.log'); }
function append(message) { fs.appendFileSync(logFile(), `[${new Date().toISOString()}] ${message}\n`, 'utf8'); }

function startRuntime() {
  const root = osRoot();
  const script = path.join(root, 'Core', 'Runtime', 'src', 'server.mjs');
  if (!fs.existsSync(script)) throw new Error(`Runtime missing: ${script}`);
  runtime = spawn(process.execPath, [script], {
    cwd: root,
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', OS_ROOT: root, OS_NO_BROWSER: '1', OS_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  runtime.stdout.on('data', (data) => append(`runtime: ${data.toString().trim()}`));
  runtime.stderr.on('data', (data) => append(`runtime-error: ${data.toString().trim()}`));
  runtime.on('exit', (code) => append(`runtime exited ${code}`));
}

async function waitForRuntime(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(`${ORIGIN}/api/health`); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('OS Runtime did not become ready');
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500, height: 960, minWidth: 1080, minHeight: 720,
    backgroundColor: '#07090d', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: true }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(ORIGIN)) event.preventDefault(); });
  await mainWindow.loadURL(ORIGIN);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    try { startRuntime(); await waitForRuntime(); await createWindow(); }
    catch (error) { append(error.stack || error.message); app.quit(); }
  });
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { if (runtime && !runtime.killed) runtime.kill(); });
