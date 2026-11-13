import { el, escapeXml, measureText, wrapSvg } from '../svg.js';
import { getLocale } from '../i18n.js';

/**
 * Render the classic standard UML stick figure actor (matching user reference).
 * @param {number} cx
 * @param {number} cy
 * @param {string} strokeColor
 * @returns {string}
 */
function renderStickFigure(cx, cy, strokeColor) {
  const headR = 12;
  const headY = cy - 24;
  const neckY = headY + headR;
  const crotchY = neckY + 36;
  const armY = neckY + 16;
  const armSpan = 18;
  const legSpan = 15;
  const legY = crotchY + 22;
  const strokeW = 2.6;

  const head = el('circle', {
    cx,
    cy: headY,
    r: headR,
    fill: 'none',
    stroke: strokeColor,
    'stroke-width': strokeW,
  });

  const spine = el('line', {
    x1: cx,
    y1: neckY,
    x2: cx,
    y2: crotchY,
    stroke: strokeColor,
    'stroke-width': strokeW,
    'stroke-linecap': 'round',
  });

  const arms = el('line', {
    x1: cx - armSpan,
    y1: armY,
    x2: cx + armSpan,
    y2: armY,
    stroke: strokeColor,
    'stroke-width': strokeW,
    'stroke-linecap': 'round',
  });

  const legs = el('path', {
    d: `M ${cx - legSpan} ${legY} L ${cx} ${crotchY} L ${cx + legSpan} ${legY}`,
    fill: 'none',
    stroke: strokeColor,
    'stroke-width': strokeW,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  return `${head}\n${spine}\n${arms}\n${legs}`;
}

/**
 * Split label into lines cleanly.
 * @param {string} text
 * @returns {string[]}
 */
function splitLabel(text) {
  if (text.includes('\n')) return text.split('\n');
  if (text.includes('(') && text.endsWith(')')) {
    const idx = text.indexOf('(');
    return [text.slice(0, idx).trim(), text.slice(idx).trim()];
  }
  const words = text.split(' ');
  if (words.length >= 4) {
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }
  return [text];
}

/**
 * Draw a strictly orthogonal line/path (zero diagonal lines rule).
 * @param {number} startX
 * @param {number} startY
 * @param {number} endX
 * @param {number} endY
 * @param {string} edgeColor
 * @param {{ forkX?: number }} [options]
 * @returns {string}
 */
function drawOrthogonalEdge(startX, startY, endX, endY, edgeColor, options = {}) {
  const dy = endY - startY;

  // Pure horizontal straight line
  if (Math.abs(dy) <= 2) {
    return el('line', {
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY,
      stroke: edgeColor,
      'stroke-width': 1.8,
      'marker-end': 'url(#uml-arrow)',
    });
  }

  // Stepped orthogonal 90-degree curve with rounded elbows
  const forkX = options.forkX || (startX + 45);
  const r = Math.min(10, Math.abs(dy) / 2);
  const isAbove = dy < 0;

  let d = '';
  if (isAbove) {
    d = `M ${startX} ${startY} L ${forkX - r} ${startY} A ${r} ${r} 0 0 0 ${forkX} ${startY - r} L ${forkX} ${endY + r} A ${r} ${r} 0 0 1 ${forkX + r} ${endY} L ${endX} ${endY}`;
  } else {
    d = `M ${startX} ${startY} L ${forkX - r} ${startY} A ${r} ${r} 0 0 1 ${forkX} ${startY + r} L ${forkX} ${endY - r} A ${r} ${r} 0 0 0 ${forkX + r} ${endY} L ${endX} ${endY}`;
  }

  return el('path', {
    d,
    fill: 'none',
    stroke: edgeColor,
    'stroke-width': 1.8,
    'stroke-linecap': 'round',
    'marker-end': 'url(#uml-arrow)',
  });
}

/**
 * Render a parsed Use Case diagram AST into an SVG string with intelligent layout.
 * @param {ReturnType<import('../parser/usecase.js').parseUseCase>} ast
 * @param {import('../themes.js').THEMES.light} theme
 * @param {{ lang?: string }} [options]
 * @returns {string}
 */
export function renderUseCase(ast, theme, options = {}) {
  const isDark = theme.background.toLowerCase() === '#0f172a' || theme.background.toLowerCase() === '#0a0e17';
  const bg = isDark ? '#0b101b' : theme.background;
  const frameBorder = isDark ? '#1e293b' : '#cbd5e1';
  const dotColor = isDark ? '#1e293b' : '#e2e8f0';
  const actorColor = isDark ? '#e2e8f0' : '#1e293b';
  const pillFill = isDark ? '#0f172a' : '#ffffff';
  const pillStroke = isDark ? '#334155' : '#94a3b8';
  const edgeColor = isDark ? '#94a3b8' : '#475569';

  const actorMap = new Map(ast.actors.map((a) => [a.id, a]));
  const useCaseMap = new Map(ast.useCases.map((u) => [u.id, u]));

  // Build relationships
  const actorChildren = new Map(ast.actors.map((a) => [a.id, []]));
  const actorParents = new Map(ast.actors.map((a) => [a.id, []]));
  const actorUseCases = new Map(ast.actors.map((a) => [a.id, []]));
  const useCaseActors = new Map(ast.useCases.map((u) => [u.id, []]));

  for (const rel of ast.relations) {
    if (actorMap.has(rel.from)) {
      if (actorMap.has(rel.to)) {
        actorChildren.get(rel.from).push(rel.to);
        actorParents.get(rel.to).push(rel.from);
      } else if (useCaseMap.has(rel.to)) {
        actorUseCases.get(rel.from).push(rel.to);
        if (!useCaseActors.has(rel.to)) useCaseActors.set(rel.to, []);
        useCaseActors.get(rel.to).push(rel.from);
      }
    }
  }

  // Partition actors:
  // Col 0: Pure source actors (point to other actors, receive nothing)
  // Col 1: Main workflow actors & subordinate actors
  const col0 = [];
  const col1 = [];

  for (const a of ast.actors) {
    const hasOut = (actorChildren.get(a.id) || []).length > 0;
    const hasIn = (actorParents.get(a.id) || []).length > 0;

    if (hasOut && !hasIn) {
      col0.push(a);
    } else {
      col1.push(a);
    }
  }

  if (col1.length === 0 && col0.length > 1) {
    col1.push(col0.pop());
  }

  // Sort Col 1 actors topologically (parent above child)
  col1.sort((a, b) => {
    const isChild = (actorChildren.get(a.id) || []).includes(b.id);
    const isParent = (actorChildren.get(b.id) || []).includes(a.id);
    if (isChild) return -1;
    if (isParent) return 1;
    return 0;
  });

  const pad = 48;
  const col0X = pad + 130;
  const col1X = pad + 380;
  const col2X = pad + 740;

  const actorSlotH = 160;
  const startY = pad + 70;

  const actorPositions = new Map();
  const useCasePositions = new Map();

  // Position Col 0 actors
  col0.forEach((a, i) => {
    actorPositions.set(a.id, {
      x: col0X,
      y: startY + i * actorSlotH,
      label: a.label,
    });
  });

  // Position Col 1 actors:
  // Align first Col 1 actor with vertical center of Col 0
  const col0CenterY = col0.length > 0 ? startY + ((col0.length - 1) * actorSlotH) / 2 : startY;
  let cursorY1 = col0.length > 0 ? col0CenterY : startY;

  col1.forEach((a) => {
    actorPositions.set(a.id, {
      x: col1X,
      y: cursorY1,
      label: a.label,
    });
    cursorY1 += actorSlotH;
  });

  // Position Use Cases (Col 2)
  // Directly align each use case with its calling actor so single cases have 100% horizontal lines
  const useCaseW = 210;
  const useCaseH = 64;
  const slotH = 75;

  const allOrderedActors = [...col1, ...col0];
  const positionedUc = new Set();

  for (const act of allOrderedActors) {
    const ucs = (actorUseCases.get(act.id) || []).filter((uId) => !positionedUc.has(uId));
    if (ucs.length === 0) continue;

    const actPos = actorPositions.get(act.id);
    if (!actPos) continue;

    if (ucs.length === 1) {
      let targetY = actPos.y;
      for (const [k, ucPos] of useCasePositions) {
        if (Math.abs(ucPos.y - targetY) < slotH) {
          targetY = ucPos.y + slotH;
        }
      }
      useCasePositions.set(ucs[0], {
        x: col2X,
        y: targetY,
        w: useCaseW,
        h: useCaseH,
        label: useCaseMap.get(ucs[0])?.label || ucs[0],
      });
      positionedUc.add(ucs[0]);
    } else {
      const startUcY = actPos.y - ((ucs.length - 1) * slotH) / 2;
      ucs.forEach((ucId, idx) => {
        let targetY = startUcY + idx * slotH;
        for (const [k, ucPos] of useCasePositions) {
          if (Math.abs(ucPos.y - targetY) < slotH) {
            targetY = ucPos.y + slotH;
          }
        }
        useCasePositions.set(ucId, {
          x: col2X,
          y: targetY,
          w: useCaseW,
          h: useCaseH,
          label: useCaseMap.get(ucId)?.label || ucId,
        });
        positionedUc.add(ucId);
      });
    }
  }

  // Handle any remaining orphan use cases
  let orphanY = startY;
  for (const u of ast.useCases) {
    if (!useCasePositions.has(u.id)) {
      while (Array.from(useCasePositions.values()).some((p) => Math.abs(p.y - orphanY) < slotH)) {
        orphanY += slotH;
      }
      useCasePositions.set(u.id, {
        x: col2X,
        y: orphanY,
        w: useCaseW,
        h: useCaseH,
        label: u.label,
      });
      orphanY += slotH;
    }
  }

  // Calculate canvas dimensions
  const allY = [
    ...Array.from(actorPositions.values()).map((p) => p.y + 80),
    ...Array.from(useCasePositions.values()).map((p) => p.y + useCaseH / 2 + 30),
  ];
  const maxY = Math.max(...allY, 440);
  const frameW = 860;
  const frameH = maxY - pad + 30;
  const totalWidth = frameW + pad * 2;
  const totalHeight = frameH + pad * 2;

  const parts = [];

  // Dot grid pattern
  const patternId = 'markuml-dot-grid';
  parts.push(`
    <defs>
      <pattern id="${patternId}" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.2" fill="${dotColor}" opacity="0.6" />
      </pattern>
    </defs>
  `);

  // Outer canvas background
  parts.push(el('rect', { x: 0, y: 0, width: totalWidth, height: totalHeight, fill: bg }));
  parts.push(el('rect', { x: 0, y: 0, width: totalWidth, height: totalHeight, fill: `url(#${patternId})` }));

  // System Boundary Box
  parts.push(
    el('rect', {
      x: pad,
      y: pad,
      width: frameW,
      height: frameH,
      rx: 6,
      fill: 'none',
      stroke: frameBorder,
      'stroke-width': 1.4,
    })
  );

  // System Boundary Title
  const titleText = ast.title || 'SISTEMA';
  parts.push(
    el(
      'text',
      {
        x: pad + 16,
        y: pad - 12,
        fill: theme.mutedText,
        'font-size': 11,
        'font-weight': '600',
        'letter-spacing': '1px',
      },
      escapeXml(titleText.toUpperCase())
    )
  );

  // Draw Relations
  // 1. Col 0 -> Col 1 branching tree (100% orthogonal)
  const col0ToCol1Target = new Map();
  for (const rel of ast.relations) {
    if (col0.some((a) => a.id === rel.from) && col1.some((a) => a.id === rel.to)) {
      if (!col0ToCol1Target.has(rel.to)) col0ToCol1Target.set(rel.to, []);
      col0ToCol1Target.get(rel.to).push(rel.from);
    }
  }

  for (const [targetId, sourceIds] of col0ToCol1Target.entries()) {
    const toPos = actorPositions.get(targetId);
    if (!toPos) continue;

    const sources = sourceIds
      .map((id) => actorPositions.get(id))
      .filter(Boolean)
      .sort((a, b) => a.y - b.y);

    if (sources.length === 0) continue;

    const busX = (col0X + col1X) / 2 + 10;
    const startX = col0X + 32;
    const targetX = toPos.x - 34;
    const r = 12;

    sources.forEach((src) => {
      const dy = toPos.y - src.y;
      let d = '';
      if (Math.abs(dy) < 5) {
        d = `M ${startX} ${src.y} L ${targetX} ${toPos.y}`;
      } else if (src.y < toPos.y) {
        d = `M ${startX} ${src.y} L ${busX - r} ${src.y} A ${r} ${r} 0 0 1 ${busX} ${src.y + r} L ${busX} ${toPos.y}`;
      } else {
        d = `M ${startX} ${src.y} L ${busX - r} ${src.y} A ${r} ${r} 0 0 0 ${busX} ${src.y - r} L ${busX} ${toPos.y}`;
      }

      parts.push(
        el('path', {
          d,
          fill: 'none',
          stroke: edgeColor,
          'stroke-width': 1.8,
          'stroke-linecap': 'round',
        })
      );
    });

    parts.push(
      el('line', {
        x1: busX,
        y1: toPos.y,
        x2: targetX,
        y2: toPos.y,
        stroke: edgeColor,
        'stroke-width': 1.8,
        'marker-end': 'url(#uml-arrow)',
      })
    );
  }

  // 2. Vertical connections in Col 1 (e.g. Supervisor down to Operador - 100% vertical straight)
  for (const rel of ast.relations) {
    const fromActor = actorPositions.get(rel.from);
    const toActor = actorPositions.get(rel.to);

    if (fromActor && toActor && !col0ToCol1Target.has(rel.to)) {
      if (Math.abs(fromActor.x - toActor.x) < 20) {
        const fromLines = splitLabel(fromActor.label);
        const y1 = fromActor.y + 60 + (fromLines.length - 1) * 16 + 8;
        const y2 = toActor.y - 38;
        parts.push(
          el('line', {
            x1: fromActor.x,
            y1,
            x2: fromActor.x,
            y2,
            stroke: edgeColor,
            'stroke-width': 1.8,
            'marker-end': 'url(#uml-arrow)',
          })
        );
      }
    }
  }

  // 3. Actor -> Use Case lines (STRICTLY ORTHOGONAL - NEVER DIAGONAL)
  for (const rel of ast.relations) {
    const fromActor = actorPositions.get(rel.from);
    const toUc = useCasePositions.get(rel.to);

    if (fromActor && toUc) {
      const startX = fromActor.x + 32;
      const startY = fromActor.y;
      const endX = toUc.x - toUc.w / 2 - 2;
      const endY = toUc.y;

      parts.push(drawOrthogonalEdge(startX, startY, endX, endY, edgeColor));
    }
  }

  // Draw Actors (Stick figure + clean separated text below feet)
  for (const actor of actorPositions.values()) {
    parts.push(renderStickFigure(actor.x, actor.y, actorColor));
    const lines = splitLabel(actor.label);
    const labelStartY = actor.y + 60;
    lines.forEach((l, idx) => {
      parts.push(
        el(
          'text',
          {
            x: actor.x,
            y: labelStartY + idx * 16,
            'text-anchor': 'middle',
            fill: theme.text,
            'font-size': 13,
            'font-weight': '500',
          },
          escapeXml(l)
        )
      );
    });
  }

  // Draw Use Cases (Pills)
  for (const uc of useCasePositions.values()) {
    parts.push(
      el('rect', {
        x: uc.x - uc.w / 2,
        y: uc.y - uc.h / 2,
        width: uc.w,
        height: uc.h,
        rx: uc.h / 2,
        fill: pillFill,
        stroke: pillStroke,
        'stroke-width': 1.6,
      })
    );

    const lines = splitLabel(uc.label);
    const startTextY = uc.y - (lines.length - 1) * 9 + 4;
    lines.forEach((l, idx) => {
      parts.push(
        el(
          'text',
          {
            x: uc.x,
            y: startTextY + idx * 18,
            'text-anchor': 'middle',
            fill: theme.text,
            'font-size': 13,
            'font-weight': '500',
          },
          escapeXml(l)
        )
      );
    });
  }

  return wrapSvg(totalWidth, totalHeight, theme, parts.join('\n'), ast.title);
}
