import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const roots = ['apps', 'packages', 'tests'];
const extensions = new Set(['.ts', '.tsx', '.css', '.json', '.md']);
const issues = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(directory, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if ([...extensions].some((ext) => entry.name.endsWith(ext))) await inspect(full);
  }
}

async function inspect(file) {
  const text = await readFile(file, 'utf8');
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/\s+$/.test(line)) issues.push(`${relative('.', file)}:${index + 1} trailing whitespace`);
    if (line.includes('\t')) issues.push(`${relative('.', file)}:${index + 1} tab character`);
  }
  if (/\bif\s*\(\s*(?:fighterId|fighter\.id|entity\.fighterId)\s*===\s*['"][^'"]+['"]/.test(text) && file.includes(join('packages', 'simulation'))) {
    issues.push(`${relative('.', file)} contains fighter-ID-specific simulation logic`);
  }
}

for (const root of roots) await walk(root);
if (issues.length > 0) {
  console.error(issues.join('\n'));
  process.exit(1);
}
console.log('Project lint passed.');
