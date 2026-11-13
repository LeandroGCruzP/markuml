/**
 * Parser for Markdown-like Class Diagrams.
 */

const RELATION_REGEX =
  /^([A-Za-z_][\w]*)(?:\s+"?([^"\s]+)"?)?\s*(--\|>|\.\.\|>|\*--|o--|-->|->)\s*(?:"?([^"\s]+)"?\s+)?([A-Za-z_][\w]*)(?:\s*:\s*(.+))?$/;

const CLASS_HEADER_REGEX = /^##\s+([A-Za-z_][\w]*)(?:\s*<<([^>]+)>>)?\s*$/;

/**
 * Normalize a class member line, supporting both `- field` and `- + method()`.
 * @param {string} raw
 * @returns {{ visibility: string, text: string, isMethod: boolean }}
 */
function parseMember(raw) {
  let line = raw.trim();
  // If formatted as markdown list item followed by explicit visibility: "- + login()"
  if (/^[-*]\s+[+\-#~]/.test(line)) {
    line = line.replace(/^[-*]\s+/, '').trim();
  }

  let visibility = '+';
  if (/^[+\-#~]/.test(line)) {
    visibility = line[0];
    line = line.slice(1).trim();
  }

  const isMethod = /\(.*\)/.test(line);
  return { visibility, text: line, isMethod };
}

/**
 * Map arrow token to semantic UML relation kind.
 * @param {string} arrow
 */
function mapRelationKind(arrow) {
  switch (arrow) {
    case '--|>':
      return 'inheritance';
    case '..|>':
      return 'implementation';
    case '*--':
      return 'composition';
    case 'o--':
      return 'aggregation';
    case '-->':
      return 'dependency';
    case '->':
    default:
      return 'association';
  }
}

/**
 * Parse a class diagram from lines of Markdown-like text.
 * @param {string[]} lines
 * @param {string} [initialTitle]
 * @returns {{ type: 'class', title: string, classes: Array<any>, relations: Array<any> }}
 */
export function parseClass(lines, initialTitle = '') {
  let title = initialTitle;
  const classMap = new Map();
  const relations = [];
  let currentClass = null;
  let inRelations = false;

  function ensureClass(name, stereotype = '') {
    if (!classMap.has(name)) {
      classMap.set(name, {
        name,
        stereotype,
        attributes: [],
        methods: [],
      });
    } else if (stereotype && !classMap.get(name).stereotype) {
      classMap.get(name).stereotype = stereotype;
    }
    return classMap.get(name);
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('<!--')) {
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      if (!title) {
        title = trimmed.replace(/^#\s+(?:class\s*:\s*)?/i, '').trim();
      }
      continue;
    }

    if (/^##\s+relations?\s*$/i.test(trimmed)) {
      inRelations = true;
      currentClass = null;
      continue;
    }

    const headerMatch = trimmed.match(CLASS_HEADER_REGEX);
    if (headerMatch) {
      inRelations = false;
      currentClass = ensureClass(headerMatch[1], (headerMatch[2] || '').trim());
      continue;
    }

    const cleaned = trimmed.replace(/^[-*]\s+(?![a-zA-Z_])/, '').trim();
    const relCandidate = trimmed.replace(/^[-*]\s+/, '').trim();

    // Check relation line (either inside ## relations or anywhere at top level)
    const relMatch = relCandidate.match(RELATION_REGEX);
    if (relMatch && (inRelations || !currentClass || relMatch[3] !== '->' || !relCandidate.includes(':'))) {
      // Distinguish `field: Type` from `ClassA -> ClassB : label`
      const [, from, fromCard = '', arrow, toCard = '', to, label = ''] = relMatch;
      ensureClass(from);
      ensureClass(to);
      relations.push({
        from,
        to,
        kind: mapRelationKind(arrow),
        fromCard: fromCard.trim(),
        toCard: toCard.trim(),
        label: label.trim(),
      });
      continue;
    }

    if (currentClass && !inRelations) {
      const member = parseMember(cleaned);
      if (member.text) {
        if (member.isMethod) {
          currentClass.methods.push(member);
        } else {
          currentClass.attributes.push(member);
        }
      }
    }
  }

  return {
    type: 'class',
    title,
    classes: Array.from(classMap.values()),
    relations,
  };
}
