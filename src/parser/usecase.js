/**
 * Parser for MarkUML Use Case Diagrams.
 */

import { getLocale } from '../i18n.js';

const USE_CASE_EDGE_REGEX = /^(.+?)\s*(--\|>|\.\.\|>|-->|->)\s*(.+)$/;

function cleanLine(line) {
  return line.trim().replace(/^[-*]\s+/, '').trim();
}

/**
 * Clean node token (actor or (use case)).
 * @param {string} raw
 * @returns {{ id: string, label: string, isUseCase: boolean }}
 */
function parseToken(raw) {
  const token = raw.trim();
  if (token.startsWith('(') && token.endsWith(')')) {
    const label = token.slice(1, -1).trim();
    return { id: label, label, isUseCase: true };
  }
  const actorMatch = token.match(/^(?:actor\s+)?(?:"([^"]+)"|([A-Za-z0-9_\s\(\)\.-]+?))(?:\s+as\s+([A-Za-z0-9_-]+))?$/i);
  if (actorMatch) {
    const label = (actorMatch[1] || actorMatch[2] || '').trim();
    const id = (actorMatch[3] || label).trim();
    return { id, label, isUseCase: false };
  }
  return { id: token, label: token, isUseCase: false };
}

/**
 * Parse a use case diagram from lines of Markdown-like text.
 * @param {string[]} lines
 * @param {string} [initialTitle]
 * @returns {{ type: 'usecase', title: string, actors: Array<{id: string, label: string}>, useCases: Array<{id: string, label: string}>, relations: Array<any>, errors: Array<{line: number, actor: string, message: string}> }}
 */
export function parseUseCase(lines, initialTitle = '', options = {}) {
  let title = initialTitle;
  const locale = getLocale(options.lang || 'en');
  const actorMap = new Map();
  const useCaseMap = new Map();
  const relations = [];
  const errors = [];
  let hasActorsSection = false;

  function findMatchingActor(name) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) return null;

    // Strict case-sensitive match by id or label
    for (const [id, act] of actorMap) {
      if (id === trimmed || act.label === trimmed) {
        return id;
      }
    }

    return null;
  }

  function ensureActor(id, label) {
    const matched = findMatchingActor(id) || (label ? findMatchingActor(label) : null);
    if (matched) {
      return actorMap.get(matched);
    }
    const actor = { id, label: label || id };
    actorMap.set(id, actor);
    return actor;
  }

  function ensureUseCase(id, label) {
    const trimmed = String(id ?? '').trim();
    for (const [existingId, uc] of useCaseMap) {
      if (existingId === trimmed || uc.label === trimmed) {
        return uc;
      }
    }
    const uc = { id: trimmed, label: label ? label.trim() : trimmed };
    useCaseMap.set(trimmed, uc);
    return uc;
  }

  let currentSection = '';

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('<!--')) {
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      if (!title) {
        title = trimmed.replace(/^#\s+(?:usecase|casos\s+de\s+uso)\s*:\s*/i, '').trim();
      }
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      const sec = trimmed.replace(/^##\s+/, '').trim().toLowerCase();
      if (sec.startsWith('actor')) {
        currentSection = 'actors';
        hasActorsSection = true;
      } else if (sec.startsWith('case')) {
        currentSection = 'cases';
      } else {
        currentSection = 'relations';
      }
      continue;
    }

    const line = cleanLine(trimmed);
    if (!line) continue;

    // Explicit actor declaration in ## actors
    if (currentSection === 'actors' || /^actor\s+/i.test(line)) {
      hasActorsSection = true;
      const parsed = parseToken(line.replace(/^actor\s+/i, ''));
      ensureActor(parsed.id, parsed.label);
      continue;
    }

    // Relation / Case edge
    const edgeMatch = line.match(USE_CASE_EDGE_REGEX);
    if (edgeMatch) {
      const [, fromRaw, arrow, toRaw] = edgeMatch;
      const fromParsed = parseToken(fromRaw);
      const toParsed = parseToken(toRaw);

      let fromId;
      if (fromParsed.isUseCase) {
        const uc = ensureUseCase(fromParsed.id, fromParsed.label);
        fromId = uc.id;
      } else {
        const matched = findMatchingActor(fromParsed.id) || findMatchingActor(fromParsed.label);
        if (hasActorsSection && !matched) {
          errors.push({
            line: lineIdx + 1,
            actor: fromParsed.id,
            message: locale.undeclaredActor(fromParsed.id),
          });
          continue; // Do NOT create undeclared actor!
        }
        const act = matched ? actorMap.get(matched) : ensureActor(fromParsed.id, fromParsed.label);
        fromId = act.id;
      }

      let toId;
      if (toParsed.isUseCase) {
        const uc = ensureUseCase(toParsed.id, toParsed.label);
        toId = uc.id;
      } else {
        const matched = findMatchingActor(toParsed.id) || findMatchingActor(toParsed.label);
        if (hasActorsSection && !matched) {
          errors.push({
            line: lineIdx + 1,
            actor: toParsed.id,
            message: locale.undeclaredActor(toParsed.id),
          });
          continue; // Do NOT create undeclared actor!
        }
        const act = matched ? actorMap.get(matched) : ensureActor(toParsed.id, toParsed.label);
        toId = act.id;
      }

      relations.push({
        from: fromId,
        to: toId,
        kind: arrow.includes('|>') ? 'generalization' : 'association',
        dashed: arrow.startsWith('--') && !arrow.includes('|>'),
      });
      continue;
    }

    // Standalone lines in ## cases (e.g. (My Case))
    if (currentSection === 'cases' && line.startsWith('(') && line.endsWith(')')) {
      ensureUseCase(line.slice(1, -1).trim(), line.slice(1, -1).trim());
    }
  }

  return {
    type: 'usecase',
    title,
    actors: Array.from(actorMap.values()),
    useCases: Array.from(useCaseMap.values()),
    relations,
    errors,
  };
}
