import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.env.AGENT_DOCS_ROOT || '.');
const source = readFileSync(resolve(root, 'AGENTS.md'), 'utf8');
const copy = resolve(root, 'CLAUDE.md');
const args = process.argv.slice(2);
if (args.length && (args.length !== 1 || args[0] !== '--write')) throw new Error('Usage: node scripts/check-agent-docs.mjs [--write]');
if (args[0] === '--write') writeFileSync(copy, source);
const errors = [];
if (!existsSync(copy) || readFileSync(copy, 'utf8') !== source) errors.push('CLAUDE.md differs from AGENTS.md; run with --write');

// Repository paths in inline code are root-relative; runtime names are prose.
for (const match of source.matchAll(/`([^`\n]+)`/g)) {
  const value = match[1];
  if (/^(?:[\w.-]+\/)+[\w.\/-]*$/.test(value) || /^[\w-]+\.(?:md|ts|tsx|js|mjs|cjs|json|yml|yaml|prisma|txt|sql|py|go|sh|css|html)$/.test(value)) {
    if (!existsSync(resolve(root, value))) errors.push(`Missing path: ${value}`);
  }
}
let directory = '';
for (const line of source.split('\n')) {
  for (const part of line.split('&&')) {
    const cd = part.match(/\bcd\s+(Backend|UI)\b/);
    if (cd) directory = cd[1];
    for (const match of part.matchAll(/\bpnpm\s+(?:run\s+)?([\w:-]+)/g)) {
      const script = match[1];
      if (script === 'exec') continue;
      const pkg = JSON.parse(readFileSync(resolve(root, directory, 'package.json'), 'utf8'));
      if (!Object.hasOwn(pkg.scripts || {}, script)) errors.push(`Undefined pnpm script in ${directory || '.'}: ${script}`);
    }
  }
}
if (errors.length) {
  console.error([...new Set(errors)].join('\n'));
  process.exitCode = 1;
} else console.log('Agent documentation checks passed.');
