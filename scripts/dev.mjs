import { spawn } from 'node:child_process';

/**
 * Runs the API bridge (port 3001) and Vite (port 3000) together so the browser
 * only ever talks to the same-origin `/api` proxy. The model credential stays
 * in the API process environment.
 */

const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';

const children = [];

function run(label, command, args, env) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env,
    shell: isWindows,
  });

  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.log(`[dev] ${label} exited with code ${code ?? 0}. Stopping the other process.`);
    shutdown(code ?? 0);
  });

  children.push(child);
  return child;
}

let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  setTimeout(() => process.exit(code), 250);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('api', npm, ['exec', '--', 'tsx', 'watch', 'server/index.ts'], {
  ...process.env,
  PORT: process.env.PORT || '3001',
  NODE_ENV: process.env.NODE_ENV || 'development',
});

run('vite', npm, ['exec', '--', 'vite', '--port=3000', '--host=0.0.0.0'], {
  ...process.env,
});