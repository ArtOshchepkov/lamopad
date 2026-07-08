// Сканирует подпапки sounds/ и пишет manifest.json: {папка: [файл.mp3, ...]}.
// Запускать после добавления/удаления mp3 в любой из подпапок (npm run scg:sounds).
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const soundsDir = dirname(fileURLToPath(import.meta.url));

const manifest = {};
for (const entry of readdirSync(soundsDir)) {
  const full = join(soundsDir, entry);
  if (!statSync(full).isDirectory()) continue;
  const files = readdirSync(full)
    .filter((f) => f.toLowerCase().endsWith('.mp3'))
    .sort();
  if (files.length) manifest[entry] = files;
}

writeFileSync(join(soundsDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const total = Object.values(manifest).reduce((n, f) => n + f.length, 0);
console.log(`manifest.json: ${Object.keys(manifest).length} folders, ${total} files`);
