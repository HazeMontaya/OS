import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './paths.mjs';

const defaults = {
  host: '127.0.0.1',
  port: 43110,
  openBrowser: false,
  requestBodyLimitBytes: 2_097_152,
  providerTimeoutMs: 120_000,
  autonomy: {
    mode: 'supervised',
    maxToolIterations: 8,
    commandTimeoutMs: 120_000
  },
  policy: {
    allowWriteInsideRoot: true,
    allowShell: false,
    allowNetworkTools: true,
    requireApprovalForMutations: true,
    allowedShellCommands: []
  },
  providers: []
};

function merge(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) return override ?? base;
  const output = { ...base };
  for (const [key, value] of Object.entries(override)) {
    output[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? merge(base?.[key] || {}, value)
      : value;
  }
  return output;
}

export function loadConfig(file = path.join(CONFIG_DIR, 'runtime.json')) {
  let parsed = {};
  if (fs.existsSync(file)) parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const config = merge(defaults, parsed);
  if (process.env.OS_HOST) config.host = process.env.OS_HOST;
  if (process.env.OS_PORT) config.port = Number(process.env.OS_PORT);
  if (!Number.isInteger(Number(config.port)) || Number(config.port) < 1 || Number(config.port) > 65535) {
    throw new Error('Invalid runtime port');
  }
  if (config.host !== '127.0.0.1' && config.host !== 'localhost' && config.host !== '::1') {
    throw new Error('OS runtime must bind to a loopback host by default');
  }
  return config;
}
