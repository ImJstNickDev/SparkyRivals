import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const expoRequire = createRequire(require.resolve('expo/config-plugins'));
expoRequire('@expo/env').load(root, { silent: true });
const profiles = JSON.parse(
  readFileSync(new URL('../eas.json', import.meta.url))
).build;
const [name, ...command] = process.argv.slice(2);
if (!name || !command.length || !profiles[name] || name.endsWith('-base')) {
  throw new Error(
    'Usage: pnpm build:profile <build-profile> <command> [args...]'
  );
}
function profileEnv(name, seen = new Set()) {
  if (seen.has(name) || !profiles[name])
    throw new Error(`Invalid profile inheritance: ${name}`);
  seen.add(name);
  const profile = profiles[name];
  return {
    ...(profile.extends ? profileEnv(profile.extends, seen) : {}),
    ...profile.env,
  };
}
// Matches EAS profile precedence. Account credentials remain in the caller's env.
const result = spawnSync(command[0], command.slice(1), {
  cwd: root,
  env: { ...process.env, ...profileEnv(name) },
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
