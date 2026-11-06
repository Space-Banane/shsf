import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const check = resolve('scripts/check-agent-docs.mjs');
test('checks references, scripts, and the generated copy', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-docs-'));
  const options = { env: { ...process.env, AGENT_DOCS_ROOT: root }, encoding: 'utf8' };
  const run = (...args) => spawnSync(process.execPath, [check, ...args], options);
  try {
    mkdirSync(join(root, 'Backend', 'src'), { recursive: true });
    writeFileSync(join(root, 'Backend', 'src', 'exists.ts'), '');
    writeFileSync(join(root, 'Backend', 'package.json'), JSON.stringify({ scripts: { test: 'true' } }));
    const doc = '`Backend/src/exists.ts`\n```bash\ncd Backend && pnpm test\n```\n';
    writeFileSync(join(root, 'AGENTS.md'), doc);
    assert.equal(run('--write').status, 0);
    assert.equal(run().status, 0);
    writeFileSync(join(root, 'CLAUDE.md'), 'drift');
    assert.match(run().stderr, /differs/);
    writeFileSync(join(root, 'AGENTS.md'), doc + '`Backend/src/missing.ts`\ncd Backend && pnpm missing\n');
    assert.equal(run('--write').status, 1);
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing path: Backend\/src\/missing.ts/);
    assert.match(result.stderr, /Undefined pnpm script in Backend: missing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
