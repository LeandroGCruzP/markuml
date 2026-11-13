import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountUML, renderMarkdownBlocks } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(__dirname, '../bin/markuml.js');

describe('Integration helpers & CLI', () => {
  it('renderMarkdownBlocks replaces uml and markuml fenced blocks with SVGs', () => {
    const md = `# Documentação

\`\`\`uml
# usecase: Sistema
Actor -> (Login)
\`\`\`
`;
    const result = renderMarkdownBlocks(md);
    assert.ok(result.includes('<div class="markuml-diagram">'));
    assert.ok(result.includes('<svg '));
    assert.ok(!result.includes('```uml'));
  });

  it('mountUML sets innerHTML on a target element', () => {
    const fakeEl = { innerHTML: '' };
    const res = mountUML(fakeEl, 'Actor -> (Login)');
    assert.equal(res.type, 'usecase');
    assert.ok(fakeEl.innerHTML.startsWith('<svg '));
  });

  it('CLI renders SVG from stdin', () => {
    const stdout = execFileSync(process.execPath, [cliPath, '--theme', 'dark'], {
      input: '# usecase: CLI Test\nUser -> (Run CLI)\n',
      encoding: 'utf8',
    });
    assert.ok(stdout.trim().startsWith('<svg '));
    assert.ok(stdout.includes('CLI Test'));
  });
});
