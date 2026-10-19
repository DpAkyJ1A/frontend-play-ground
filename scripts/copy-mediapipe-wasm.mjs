// Copies the MediaPipe vision WASM runtime into public/ so Eye Control serves it
// from our own origin, pinned to the installed package version. Runs on postinstall;
// the copies are gitignored.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'mediapipe');
const files = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'];

mkdirSync(target, { recursive: true });
for (const file of files) {
  const source = require.resolve(`@mediapipe/tasks-vision/${file}`);
  copyFileSync(source, join(target, file));
}
console.log(`mediapipe: copied ${files.join(', ')} to public/mediapipe`);
