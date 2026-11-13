import { parseSequence } from './sequence.js';
import { parseClass } from './class.js';
import { parseFlow } from './flow.js';

/**
 * Detect diagram type and optional title from the source text.
 * @param {string[]} lines
 * @returns {{ type: 'sequence' | 'class' | 'flow', title: string }}
 */
function detectType(lines) {
  let explicitType = null;
  let title = '';

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('<!--')) continue;

    // # sequence: Title | # class: Title | # flow: Title
    const headingType = line.match(/^#\s+(sequence|class|flow(?:chart)?|activity)(?:\s*:\s*(.*))?$/i);
    if (headingType) {
      const rawType = headingType[1].toLowerCase();
      explicitType = rawType === 'class' ? 'class' : rawType === 'sequence' ? 'sequence' : 'flow';
      title = (headingType[2] || '').trim();
      break;
    }

    // type: sequence | uml: class
    const kvType = line.match(/^(?:type|uml)\s*:\s*(sequence|class|flow(?:chart)?|activity)$/i);
    if (kvType) {
      const rawType = kvType[1].toLowerCase();
      explicitType = rawType === 'class' ? 'class' : rawType === 'sequence' ? 'sequence' : 'flow';
      continue;
    }
  }

  if (explicitType) {
    return { type: explicitType, title };
  }

  // Heuristic detection when no explicit type header is provided
  const joined = lines.join('\n');
  if (/^##\s+[A-Za-z_][\w]*(?:\s*<<[^>]+>>)?\s*$/m.test(joined) && !/^##\s+participants/im.test(joined)) {
    if (/(--\|>|\.\.\|>|\*--|o--)/m.test(joined) || /^\s*[+\-#~]\s+\w+/m.test(joined)) {
      return { type: 'class', title };
    }
  }
  if (/[\(\[\{].+?[\)\]\}]\s*(-->|->)/.test(joined)) {
    return { type: 'flow', title };
  }

  return { type: 'sequence', title };
}

/**
 * Parse Markdown-like UML text into a structured AST.
 * @param {string} source
 * @param {{ type?: 'sequence' | 'class' | 'flow' }} [options]
 */
export function parseUML(source, options = {}) {
  if (typeof source !== 'string') {
    throw new TypeError('MarkUML: source must be a string.');
  }

  const lines = source.split(/\r?\n/);
  const detected = detectType(lines);
  const type = options.type || detected.type;

  switch (type) {
    case 'class':
      return parseClass(lines, detected.title);
    case 'flow':
      return parseFlow(lines, detected.title);
    case 'sequence':
    default:
      return parseSequence(lines, detected.title);
  }
}
