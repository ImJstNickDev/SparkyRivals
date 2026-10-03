import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Native target names stay stable; workspace and bundle follow generated config.
const SCHEME = 'SparkyFitnessWatch';
const workspaces = readdirSync('ios').filter((name) =>
  name.endsWith('.xcworkspace')
);
if (workspaces.length !== 1) throw new Error('Run a clean iOS prebuild first.');
const device = process.argv.includes('--device');
const derivedDataPath = resolve('.expo/watch-build');
console.log(`› Building ${SCHEME} scheme...`);
execFileSync(
  'xcodebuild',
  [
    '-workspace',
    join('ios', workspaces[0]),
    '-scheme',
    SCHEME,
    '-configuration',
    'Debug',
    '-derivedDataPath',
    derivedDataPath,
    '-destination',
    device ? 'generic/platform=watchOS' : 'generic/platform=watchOS Simulator',
    'build',
    '-quiet',
  ],
  { stdio: 'inherit' }
);
if (device) process.exit(0);
const builtAppPath = join(
  derivedDataPath,
  `Build/Products/Debug-watchsimulator/${SCHEME}.app`
);
if (!existsSync(builtAppPath))
  throw new Error(`Built app not found: ${builtAppPath}`);
const bundleId = execFileSync(
  '/usr/libexec/PlistBuddy',
  ['-c', 'Print CFBundleIdentifier', join(builtAppPath, 'Info.plist')],
  { encoding: 'utf8' }
).trim();

// Find an available watchOS simulator
console.log('› Finding available Apple Watch simulator...');
const deviceListJson = execFileSync(
  'xcrun',
  ['simctl', 'list', 'devices', 'available', '-j'],
  {
    encoding: 'utf-8',
  }
);
const { devices } = JSON.parse(deviceListJson);

let watchDevice = null;
for (const [runtime, list] of Object.entries(devices)) {
  if (runtime.includes('watchOS')) {
    watchDevice =
      list.find((d) => d.name.includes('Apple Watch Series 11 (46mm)')) ||
      list[0];
    if (watchDevice) break;
  }
}

if (!watchDevice) {
  console.error('❌ No available watchOS simulator found.');
  process.exit(1);
}

console.log(
  `› Booting Apple Watch Simulator: ${watchDevice.name} (${watchDevice.udid})...`
);
execFileSync('open', ['-a', 'Simulator'], { stdio: 'ignore' });
try {
  execFileSync('xcrun', ['simctl', 'boot', watchDevice.udid], {
    stdio: 'ignore',
  });
} catch {
  // Already booted
}

console.log('› Installing app on simulator...');
execFileSync('xcrun', ['simctl', 'install', watchDevice.udid, builtAppPath], {
  stdio: 'inherit',
});

console.log(`› Launching ${bundleId}...`);
execFileSync('xcrun', ['simctl', 'launch', watchDevice.udid, bundleId], {
  stdio: 'inherit',
});

console.log('✔ Apple Watch App launched successfully!');
