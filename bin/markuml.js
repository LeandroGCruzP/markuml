#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { renderSVG, renderMarkdownBlocks } from '../src/index.js';

function printHelp() {
  console.log(`markuml - Generate SVG UML diagrams from Markdown-like syntax

Usage:
  markuml <input-file> [-o <output-file>] [--theme light|dark] [--markdown]
  cat diagram.md | markuml [--theme light|dark]

Options:
  -o, --output <file>   Write output to a file instead of stdout
  -t, --theme <name>    Theme: light (default) or dark
  -m, --markdown        Transform \`\`\`uml / \`\`\`markuml blocks inside a Markdown file
  -h, --help            Show this help message
`);
}

const args = process.argv.slice(2);
let inputFile = null;
let outputFile = null;
let theme = 'light';
let markdownMode = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-h' || arg === '--help') {
    printHelp();
    process.exit(0);
  } else if (arg === '-o' || arg === '--output') {
    outputFile = args[++i];
  } else if (arg === '-t' || arg === '--theme') {
    theme = args[++i] || 'light';
  } else if (arg === '-m' || arg === '--markdown') {
    markdownMode = true;
  } else if (!arg.startsWith('-')) {
    inputFile = arg;
  }
}

let source = '';
if (inputFile) {
  source = fs.readFileSync(path.resolve(inputFile), 'utf8');
} else if (!process.stdin.isTTY) {
  source = fs.readFileSync(0, 'utf8');
} else {
  printHelp();
  process.exit(1);
}

const output = markdownMode
  ? renderMarkdownBlocks(source, { theme })
  : renderSVG(source, { theme });

if (outputFile) {
  fs.writeFileSync(path.resolve(outputFile), output, 'utf8');
} else {
  process.stdout.write(output + '\n');
}
