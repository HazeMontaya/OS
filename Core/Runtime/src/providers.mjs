import { spawn } from 'node:child_process';
import { ROOT } from './paths.mjs';

function run(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, windowsHide: true, shell: false, env: process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(stderr.trim() || `${command} exited with ${code}`));
      else resolve(stdout.trim());
    });
  });
}

function argsFor(provider, prompt) {
  return (provider.args || []).map((arg) => String(arg).replaceAll('{prompt}', prompt));
}

export function createProviders(config) {
  const providers = (config.providers || []).filter((p) => p.enabled !== false);

  async function probe(provider) {
    const pathExt = process.platform === 'win32' ? ['', '.cmd', '.exe', '.bat'] : [''];
    const envPath = (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const exists = envPath.some((dir) => pathExt.some((ext) => fs.existsSync(path.join(dir, `${provider.command}${ext}`))));
    return { id: provider.id, command: provider.command, available: exists };
  }

  return {
    status: async () => Promise.all(providers.map(probe)),
    generate: async (prompt, preferredProvider) => {
      const ordered = preferredProvider
        ? [...providers.filter((p) => p.id === preferredProvider), ...providers.filter((p) => p.id !== preferredProvider)]
        : providers;
      const errors = [];
      for (const provider of ordered) {
        const status = await probe(provider);
        if (!status.available) { errors.push(`${provider.id}: unavailable`); continue; }
        try {
          const text = await run(provider.command, argsFor(provider, prompt), config.autonomy.commandTimeoutMs);
          return { provider: provider.id, text };
        } catch (error) {
          errors.push(`${provider.id}: ${error.message}`);
        }
      }
      throw new Error(`No AI provider completed the request. ${errors.join(' | ')}`);
    }
  };
}
