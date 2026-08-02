import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'out');
const dist = path.join(root, 'dist');
for (const target of [out, dist]) {
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error(`Unsafe generated path: ${target}`);
  fs.rmSync(target, { recursive: true, force: true });
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = spawnSync(npm, ['run', 'build'], {
  cwd: root,
  env: { ...process.env, SITES_STATIC_EXPORT: '1', NEXT_TELEMETRY_DISABLED: '1' },
  shell: process.platform === 'win32',
  stdio: 'inherit',
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

fs.mkdirSync(path.join(dist, 'server'), { recursive: true });
fs.cpSync(out, path.join(dist, 'client'), { recursive: true });
fs.copyFileSync(path.join(root, 'worker', 'sites-static.js'), path.join(dist, 'server', 'index.js'));
console.log('Sites bundle created in dist/');
