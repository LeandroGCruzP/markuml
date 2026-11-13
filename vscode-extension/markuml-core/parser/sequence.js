/**
 * Parser for Markdown-like Sequence Diagrams.
 */

const MSG_REGEX = /^(.+?)\s*(-->>|->>|-->|->)\s*(.+?)(?:\s*:\s*(.*))?$/;
const NOTE_REGEX = /^note\s+over\s+([^:]+?)\s*:\s*(.+)$/i;
const PARTICIPANT_REGEX = /^(?:participant\s+)?(.+?)\s+as\s+"?([^"]+)"?$/i;

/**
 * Strip leading markdown list markers (- or *) and whitespace.
 * @param {string} line
 * @returns {string}
 */
function cleanLine(line) {
  return line.trim().replace(/^[-*]\s+/, '').trim();
}

/**
 * Parse a sequence diagram from lines of Markdown-like text.
 * @param {string[]} lines
 * @param {string} [initialTitle]
 * @returns {{ type: 'sequence', title: string, participants: Array<{id: string, label: string}>, events: Array<any> }}
 */
export function parseSequence(lines, initialTitle = '') {
  let title = initialTitle;
  const participantMap = new Map();
  const events = [];
  let section = 'body';

  function ensureParticipant(rawId, label) {
    const id = rawId.trim();
    if (!id) return null;
    if (!participantMap.has(id)) {
      participantMap.set(id, { id, label: label ? label.trim() : id });
    } else if (label) {
      participantMap.get(id).label = label.trim();
    }
    return participantMap.get(id);
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('<!--')) {
      continue;
    }

    // Top-level heading
    if (/^#\s+/.test(trimmed)) {
      if (!title) {
        title = trimmed.replace(/^#\s+(?:sequence\s*:\s*)?/i, '').trim();
      }
      continue;
    }

    // Section headings (## participants, ## flow, ## messages)
    if (/^##\s+/.test(trimmed)) {
      const secName = trimmed.replace(/^##\s+/, '').trim().toLowerCase();
      if (secName.startsWith('participant') || secName.startsWith('actor')) {
        section = 'participants';
      } else {
        section = 'body';
      }
      continue;
    }

    const line = cleanLine(trimmed);
    if (!line) continue;

    // Explicit participant declaration
    if (section === 'participants' || /^participant\s+/i.test(line)) {
      const pMatch = line.match(PARTICIPANT_REGEX);
      if (pMatch) {
        ensureParticipant(pMatch[1], pMatch[2]);
      } else {
        const id = line.replace(/^participant\s+/i, '').replace(/^"|"$/g, '').trim();
        ensureParticipant(id, id);
      }
      continue;
    }

    // Note event
    const noteMatch = line.match(NOTE_REGEX);
    if (noteMatch) {
      const targets = noteMatch[1]
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      targets.forEach((t) => ensureParticipant(t));
      if (targets.length > 0) {
        events.push({
          kind: 'note',
          targets,
          text: noteMatch[2].trim(),
        });
      }
      continue;
    }

    // Message event
    const msgMatch = line.match(MSG_REGEX);
    if (msgMatch) {
      const [, fromRaw, arrow, toRaw, text = ''] = msgMatch;
      const from = fromRaw.trim();
      const to = toRaw.trim();
      ensureParticipant(from);
      ensureParticipant(to);
      events.push({
        kind: 'message',
        from,
        to,
        dashed: arrow.startsWith('--'),
        open: arrow.endsWith('>>'),
        text: text.trim(),
      });
    }
  }

  return {
    type: 'sequence',
    title,
    participants: Array.from(participantMap.values()),
    events,
  };
}
