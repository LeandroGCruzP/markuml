import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');

const order = [
  'i18n.js',
  'themes.js',
  'svg.js',
  'parser/usecase.js',
  'parser/index.js',
  'renderer/usecase.js',
  'renderer/index.js',
  'index.js',
];

const strippedParts = [];

for (const rel of order) {
  const content = fs.readFileSync(path.join(srcDir, rel), 'utf8');
  let clean = content.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  clean = clean.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
  clean = clean.replace(/^export\s+(const|let|var|function|class)\s+/gm, '$1 ');
  strippedParts.push(`// --- ${rel} ---\n` + clean.trim());
}

const cjsOutput = `/**
 * MarkUML - Use Case Diagrams only
 */
${strippedParts.join('\n\n')}

module.exports = {
  MESSAGES,
  getLocale,
  THEMES,
  resolveTheme,
  parseUML,
  renderAST,
  renderSVG,
  renderUML,
  mountUML,
  renderMarkdownBlocks,
  escapeXml,
  measureText
};
`;

const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'markuml.cjs'), cjsOutput, 'utf8');
console.log('Built dist/markuml.cjs successfully');
