import { el, escapeXml, measureText, wrapSvg } from '../svg.js';

/**
 * Render a parsed sequence diagram AST into an SVG string.
 * @param {ReturnType<import('../parser/sequence.js').parseSequence>} ast
 * @param {import('../themes.js').THEMES.light} theme
 * @returns {string}
 */
export function renderSequence(ast, theme) {
  const pad = theme.padding;
  const boxHeight = 38;
  const rowHeight = 46;
  const selfLoopHeight = 36;
  const titleHeight = ast.title ? 34 : 0;

  if (ast.participants.length === 0) {
    const emptyText = el(
      'text',
      { x: pad, y: pad + 18, fill: theme.mutedText, 'font-size': theme.fontSize },
      'Empty sequence diagram'
    );
    return wrapSvg(240, 80, theme, emptyText, ast.title);
  }

  const pIndex = new Map(ast.participants.map((p, i) => [p.id, i]));
  const boxWidths = ast.participants.map((p) =>
    Math.max(100, Math.ceil(measureText(p.label, theme.fontSize) + 32))
  );

  // Compute minimum gap between adjacent participants based on message widths
  const gaps = new Array(Math.max(0, ast.participants.length - 1)).fill(140);
  for (let i = 0; i < gaps.length; i++) {
    gaps[i] = Math.max(gaps[i], (boxWidths[i] + boxWidths[i + 1]) / 2 + 36);
  }

  for (const ev of ast.events) {
    if (ev.kind === 'message' && ev.from !== ev.to) {
      const i1 = pIndex.get(ev.from);
      const i2 = pIndex.get(ev.to);
      if (i1 !== undefined && i2 !== undefined) {
        const left = Math.min(i1, i2);
        const right = Math.max(i1, i2);
        const needed = measureText(ev.text, theme.fontSize) + 48;
        const spanCount = right - left;
        const perGap = needed / spanCount;
        for (let g = left; g < right; g++) {
          gaps[g] = Math.max(gaps[g], perGap);
        }
      }
    }
  }

  // X center for each participant
  const centers = [];
  let cursorX = pad + boxWidths[0] / 2;
  centers.push(cursorX);
  for (let i = 1; i < ast.participants.length; i++) {
    cursorX += gaps[i - 1];
    centers.push(cursorX);
  }

  const lastCenter = centers[centers.length - 1];
  const lastWidth = boxWidths[boxWidths.length - 1];
  const rightMostSelfExtra = ast.events.some(
    (e) => e.kind === 'message' && e.from === e.to && e.from === ast.participants[ast.participants.length - 1].id
  )
    ? 80
    : 0;
  const totalWidth = lastCenter + lastWidth / 2 + pad + rightMostSelfExtra;

  const topBoxY = pad + titleHeight;
  let currentY = topBoxY + boxHeight + 28;

  const eventPositions = ast.events.map((ev) => {
    const y = currentY;
    if (ev.kind === 'message' && ev.from === ev.to) {
      currentY += rowHeight + 10;
    } else if (ev.kind === 'note') {
      currentY += rowHeight + 6;
    } else {
      currentY += rowHeight;
    }
    return y;
  });

  const bottomBoxY = currentY + 12;
  const totalHeight = bottomBoxY + boxHeight + pad;

  const parts = [];

  // Title
  if (ast.title) {
    parts.push(
      el(
        'text',
        {
          x: totalWidth / 2,
          y: pad + 18,
          'text-anchor': 'middle',
          fill: theme.titleText,
          'font-size': theme.titleFontSize,
          'font-weight': '600',
        },
        escapeXml(ast.title)
      )
    );
  }

  // Lifelines
  ast.participants.forEach((p, idx) => {
    const cx = centers[idx];
    parts.push(
      el('line', {
        x1: cx,
        y1: topBoxY + boxHeight,
        x2: cx,
        y2: bottomBoxY,
        stroke: theme.lifelineStroke,
        'stroke-width': 1.4,
        'stroke-dasharray': '5,5',
      })
    );
  });

  // Top & Bottom Participant Boxes
  const drawParticipantBox = (p, idx, y) => {
    const w = boxWidths[idx];
    const x = centers[idx] - w / 2;
    parts.push(
      el('rect', {
        x,
        y,
        width: w,
        height: boxHeight,
        rx: theme.borderRadius,
        fill: theme.accentFill,
        stroke: theme.accentStroke,
        'stroke-width': 1.5,
      })
    );
    parts.push(
      el(
        'text',
        {
          x: centers[idx],
          y: y + boxHeight / 2 + 4.5,
          'text-anchor': 'middle',
          fill: theme.text,
          'font-size': theme.fontSize,
          'font-weight': '600',
        },
        escapeXml(p.label)
      )
    );
  };

  ast.participants.forEach((p, idx) => {
    drawParticipantBox(p, idx, topBoxY);
    drawParticipantBox(p, idx, bottomBoxY);
  });

  // Events (messages and notes)
  ast.events.forEach((ev, idx) => {
    const y = eventPositions[idx];

    if (ev.kind === 'note') {
      const indices = ev.targets.map((t) => pIndex.get(t)).filter((i) => i !== undefined);
      const minX = Math.min(...indices.map((i) => centers[i]));
      const maxX = Math.max(...indices.map((i) => centers[i]));
      const noteW = Math.max(maxX - minX + 40, measureText(ev.text, theme.fontSize - 1) + 28);
      const noteH = 30;
      const noteX = (minX + maxX) / 2 - noteW / 2;
      const noteY = y - 15;

      parts.push(
        el('rect', {
          x: noteX,
          y: noteY,
          width: noteW,
          height: noteH,
          rx: 4,
          fill: theme.noteFill,
          stroke: theme.noteStroke,
          'stroke-width': 1.2,
        })
      );
      parts.push(
        el(
          'text',
          {
            x: noteX + noteW / 2,
            y: noteY + noteH / 2 + 4,
            'text-anchor': 'middle',
            fill: theme.text,
            'font-size': theme.fontSize - 1,
          },
          escapeXml(ev.text)
        )
      );
      return;
    }

    const fromIdx = pIndex.get(ev.from);
    const toIdx = pIndex.get(ev.to);
    if (fromIdx === undefined || toIdx === undefined) return;

    const x1 = centers[fromIdx];
    const x2 = centers[toIdx];
    const marker = ev.open ? 'url(#uml-open-arrow)' : 'url(#uml-arrow)';
    const dashAttr = ev.dashed ? '6,4' : undefined;

    if (fromIdx === toIdx) {
      // Self-message loop
      const loopW = 38;
      parts.push(
        el('path', {
          d: `M ${x1} ${y} L ${x1 + loopW} ${y} L ${x1 + loopW} ${y + selfLoopHeight - 10} L ${x1 + 2} ${y + selfLoopHeight - 10}`,
          fill: 'none',
          stroke: theme.edgeStroke,
          'stroke-width': 1.5,
          'stroke-dasharray': dashAttr,
          'marker-end': marker,
        })
      );
      if (ev.text) {
        parts.push(
          el(
            'text',
            {
              x: x1 + loopW + 8,
              y: y + (selfLoopHeight - 10) / 2 + 4,
              'text-anchor': 'start',
              fill: theme.text,
              'font-size': theme.fontSize - 0.5,
            },
            escapeXml(ev.text)
          )
        );
      }
      return;
    }

    const dir = x2 > x1 ? 1 : -1;
    parts.push(
      el('line', {
        x1,
        y1: y,
        x2: x2 - dir * 3,
        y2: y,
        stroke: theme.edgeStroke,
        'stroke-width': 1.5,
        'stroke-dasharray': dashAttr,
        'marker-end': marker,
      })
    );

    if (ev.text) {
      const midX = (x1 + x2) / 2;
      const textW = measureText(ev.text, theme.fontSize - 0.5) + 10;
      parts.push(
        el('rect', {
          x: midX - textW / 2,
          y: y - 20,
          width: textW,
          height: 16,
          rx: 3,
          fill: theme.labelBg,
        })
      );
      parts.push(
        el(
          'text',
          {
            x: midX,
            y: y - 8,
            'text-anchor': 'middle',
            fill: theme.text,
            'font-size': theme.fontSize - 0.5,
          },
          escapeXml(ev.text)
        )
      );
    }
  });

  return wrapSvg(totalWidth, totalHeight, theme, parts.join('\n'), ast.title);
}
