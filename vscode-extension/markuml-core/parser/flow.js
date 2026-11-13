/**
 * Parser for Markdown-like Flowchart / Activity Diagrams.
 */

const EDGE_REGEX = /^(.+?)\s*(-->|->)\s*(?:\|([^|]+)\|\s*)?(.+)$/;

/**
 * Parse a node token like `(Start)`, `[Process]`, `{Decision}`, or `id[Label]`.
 * @param {string} raw
 * @returns {{ id: string, label: string, shape: 'terminal' | 'process' | 'decision' }}
 */
function parseNodeToken(raw) {
  const token = raw.trim();
  const explicitMatch = token.match(/^([A-Za-z_][\w-]*)\s*(\((.+)\)|\[(.+)\]|\{(.+)\})$/);
  if (explicitMatch) {
    const id = explicitMatch[1];
    if (explicitMatch[3] !== undefined) return { id, label: explicitMatch[3].trim(), shape: 'terminal' };
    if (explicitMatch[4] !== undefined) return { id, label: explicitMatch[4].trim(), shape: 'process' };
    return { id, label: explicitMatch[5].trim(), shape: 'decision' };
  }

  if (token.startsWith('(') && token.endsWith(')')) {
    const label = token.slice(1, -1).trim();
    return { id: label, label, shape: 'terminal' };
  }
  if (token.startsWith('{') && token.endsWith('}')) {
    const label = token.slice(1, -1).trim();
    return { id: label, label, shape: 'decision' };
  }
  if (token.startsWith('[') && token.endsWith(']')) {
    const label = token.slice(1, -1).trim();
    return { id: label, label, shape: 'process' };
  }
  return { id: token, label: token, shape: 'process' };
}

/**
 * Parse a flowchart / activity diagram from lines of Markdown-like text.
 * @param {string[]} lines
 * @param {string} [initialTitle]
 * @returns {{ type: 'flow', title: string, nodes: Array<any>, edges: Array<any> }}
 */
export function parseFlow(lines, initialTitle = '') {
  let title = initialTitle;
  const nodeMap = new Map();
  const edges = [];

  function registerNode(token) {
    const parsed = parseNodeToken(token);
    if (!nodeMap.has(parsed.id)) {
      nodeMap.set(parsed.id, parsed);
    } else {
      const existing = nodeMap.get(parsed.id);
      if (parsed.label !== parsed.id) existing.label = parsed.label;
      if (parsed.shape !== 'process') existing.shape = parsed.shape;
    }
    return nodeMap.get(parsed.id);
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('<!--')) {
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      if (!title) {
        title = trimmed.replace(/^#\s+(?:flow(?:chart)?|activity)\s*:\s*/i, '').trim();
      }
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      continue;
    }

    const line = trimmed.replace(/^[-*]\s+/, '').trim();
    const edgeMatch = line.match(EDGE_REGEX);
    if (edgeMatch) {
      const [, fromRaw, arrow, label = '', toRaw] = edgeMatch;
      const fromNode = registerNode(fromRaw);
      const toNode = registerNode(toRaw);
      edges.push({
        from: fromNode.id,
        to: toNode.id,
        dashed: arrow === '-->',
        label: label.trim(),
      });
    }
  }

  return {
    type: 'flow',
    title,
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}
