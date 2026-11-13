import { el, escapeXml, measureText, wrapSvg } from '../svg.js';

/**
 * Compute dimensions for a class box.
 * @param {any} cls
 * @param {import('../themes.js').THEMES.light} theme
 */
function measureClassBox(cls, theme) {
  const fontSize = theme.fontSize;
  const monoSize = fontSize - 1;
  const lineH = 20;
  const headerH = cls.stereotype ? 44 : 32;

  const titleW = measureText(cls.name, fontSize + 1) + 28;
  const stereoW = cls.stereotype ? measureText(`<<${cls.stereotype}>>`, fontSize - 2) + 28 : 0;

  const memberTexts = [
    ...cls.attributes.map((a) => `${a.visibility} ${a.text}`),
    ...cls.methods.map((m) => `${m.visibility} ${m.text}`),
  ];
  const maxMemberW = memberTexts.reduce(
    (max, t) => Math.max(max, measureText(t, monoSize, true) + 24),
    0
  );

  const width = Math.max(150, Math.ceil(Math.max(titleW, stereoW, maxMemberW)));
  const attrH = cls.attributes.length > 0 ? cls.attributes.length * lineH + 12 : 14;
  const methodH = cls.methods.length > 0 ? cls.methods.length * lineH + 12 : 14;
  const height = headerH + attrH + methodH;

  return { width, height, headerH, attrH, methodH, lineH };
}

/**
 * Find the intersection point on a rectangle's border from its center toward target (tx, ty).
 */
function boxEdgePoint(box, tx, ty) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const halfW = box.width / 2;
  const halfH = box.height / 2;
  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}

/**
 * Render a parsed class diagram AST into an SVG string.
 * @param {ReturnType<import('../parser/class.js').parseClass>} ast
 * @param {import('../themes.js').THEMES.light} theme
 * @returns {string}
 */
export function renderClass(ast, theme) {
  const pad = theme.padding;
  const titleHeight = ast.title ? 34 : 0;

  if (ast.classes.length === 0) {
    const emptyText = el(
      'text',
      { x: pad, y: pad + 18, fill: theme.mutedText, 'font-size': theme.fontSize },
      'Empty class diagram'
    );
    return wrapSvg(240, 80, theme, emptyText, ast.title);
  }

  const measured = ast.classes.map((cls) => ({
    cls,
    ...measureClassBox(cls, theme),
  }));

  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(measured.length))));
  const colGap = 72;
  const rowGap = 64;

  // Compute column widths and row heights
  const colWidths = new Array(cols).fill(0);
  const rows = Math.ceil(measured.length / cols);
  const rowHeights = new Array(rows).fill(0);

  measured.forEach((item, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    colWidths[col] = Math.max(colWidths[col], item.width);
    rowHeights[row] = Math.max(rowHeights[row], item.height);
  });

  const colX = [];
  let cx = pad;
  for (let c = 0; c < cols; c++) {
    colX.push(cx);
    cx += colWidths[c] + colGap;
  }

  const rowY = [];
  let cy = pad + titleHeight;
  for (let r = 0; r < rows; r++) {
    rowY.push(cy);
    cy += rowHeights[r] + rowGap;
  }

  const boxMap = new Map();
  measured.forEach((item, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    item.x = colX[col] + (colWidths[col] - item.width) / 2;
    item.y = rowY[row];
    boxMap.set(item.cls.name, item);
  });

  const totalWidth = cx - colGap + pad;
  const totalHeight = cy - rowGap + pad;
  const parts = [];

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

  // Draw relations first (behind boxes)
  for (const rel of ast.relations) {
    const fromBox = boxMap.get(rel.from);
    const toBox = boxMap.get(rel.to);
    if (!fromBox || !toBox) continue;

    const fromCenter = { x: fromBox.x + fromBox.width / 2, y: fromBox.y + fromBox.height / 2 };
    const toCenter = { x: toBox.x + toBox.width / 2, y: toBox.y + toBox.height / 2 };
    const p1 = boxEdgePoint(fromBox, toCenter.x, toCenter.y);
    const p2 = boxEdgePoint(toBox, fromCenter.x, fromCenter.y);

    const dashed = rel.kind === 'dependency' || rel.kind === 'implementation' ? '6,4' : undefined;
    let markerEnd;
    let markerStart;

    if (rel.kind === 'inheritance' || rel.kind === 'implementation') {
      markerEnd = 'url(#uml-triangle)';
    } else if (rel.kind === 'composition') {
      markerStart = 'url(#uml-diamond-filled)';
    } else if (rel.kind === 'aggregation') {
      markerStart = 'url(#uml-diamond-hollow)';
    } else {
      markerEnd = 'url(#uml-open-arrow)';
    }

    parts.push(
      el('line', {
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        stroke: theme.edgeStroke,
        'stroke-width': 1.5,
        'stroke-dasharray': dashed,
        'marker-start': markerStart,
        'marker-end': markerEnd,
      })
    );

    if (rel.label) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const lw = measureText(rel.label, theme.fontSize - 1) + 10;
      parts.push(
        el('rect', {
          x: mx - lw / 2,
          y: my - 9,
          width: lw,
          height: 18,
          rx: 3,
          fill: theme.labelBg,
        })
      );
      parts.push(
        el(
          'text',
          {
            x: mx,
            y: my + 4,
            'text-anchor': 'middle',
            fill: theme.mutedText,
            'font-size': theme.fontSize - 1,
          },
          escapeXml(rel.label)
        )
      );
    }

    if (rel.fromCard) {
      const cx1 = p1.x + (p2.x - p1.x) * 0.14;
      const cy1 = p1.y + (p2.y - p1.y) * 0.14 - 6;
      parts.push(
        el(
          'text',
          { x: cx1, y: cy1, 'text-anchor': 'middle', fill: theme.text, 'font-size': theme.fontSize - 2 },
          escapeXml(rel.fromCard)
        )
      );
    }
    if (rel.toCard) {
      const cx2 = p2.x - (p2.x - p1.x) * 0.14;
      const cy2 = p2.y - (p2.y - p1.y) * 0.14 - 6;
      parts.push(
        el(
          'text',
          { x: cx2, y: cy2, 'text-anchor': 'middle', fill: theme.text, 'font-size': theme.fontSize - 2 },
          escapeXml(rel.toCard)
        )
      );
    }
  }

  // Draw class boxes
  for (const box of measured) {
    const { cls, x, y, width, height, headerH, attrH, lineH } = box;

    // Outer box
    parts.push(
      el('rect', {
        x,
        y,
        width,
        height,
        rx: theme.borderRadius,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        'stroke-width': 1.5,
      })
    );

    // Header background
    parts.push(
      el('rect', {
        x,
        y,
        width,
        height: headerH,
        rx: theme.borderRadius,
        fill: theme.nodeHeaderFill,
        stroke: theme.nodeStroke,
        'stroke-width': 1.5,
      })
    );
    // Cover bottom rounded corners of header
    parts.push(
      el('rect', {
        x: x + 0.75,
        y: y + headerH - theme.borderRadius,
        width: width - 1.5,
        height: theme.borderRadius,
        fill: theme.nodeHeaderFill,
      })
    );

    if (cls.stereotype) {
      parts.push(
        el(
          'text',
          {
            x: x + width / 2,
            y: y + 15,
            'text-anchor': 'middle',
            fill: theme.mutedText,
            'font-size': theme.fontSize - 2,
            'font-style': 'italic',
          },
          escapeXml(`<<${cls.stereotype}>>`)
        )
      );
      parts.push(
        el(
          'text',
          {
            x: x + width / 2,
            y: y + 34,
            'text-anchor': 'middle',
            fill: theme.titleText,
            'font-size': theme.fontSize + 0.5,
            'font-weight': '700',
          },
          escapeXml(cls.name)
        )
      );
    } else {
      parts.push(
        el(
          'text',
          {
            x: x + width / 2,
            y: y + 21,
            'text-anchor': 'middle',
            fill: theme.titleText,
            'font-size': theme.fontSize + 0.5,
            'font-weight': '700',
          },
          escapeXml(cls.name)
        )
      );
    }

    // Divider between header & attributes
    const attrTop = y + headerH;
    parts.push(
      el('line', {
        x1: x,
        y1: attrTop,
        x2: x + width,
        y2: attrTop,
        stroke: theme.nodeStroke,
        'stroke-width': 1.2,
      })
    );

    // Attributes
    cls.attributes.forEach((attr, i) => {
      parts.push(
        el(
          'text',
          {
            x: x + 12,
            y: attrTop + 18 + i * lineH,
            fill: theme.text,
            'font-size': theme.fontSize - 1,
            'font-family': theme.monoFamily,
          },
          escapeXml(`${attr.visibility} ${attr.text}`)
        )
      );
    });

    // Divider between attributes & methods
    const methodTop = attrTop + attrH;
    parts.push(
      el('line', {
        x1: x,
        y1: methodTop,
        x2: x + width,
        y2: methodTop,
        stroke: theme.nodeStroke,
        'stroke-width': 1.2,
      })
    );

    // Methods
    cls.methods.forEach((m, i) => {
      parts.push(
        el(
          'text',
          {
            x: x + 12,
            y: methodTop + 18 + i * lineH,
            fill: theme.text,
            'font-size': theme.fontSize - 1,
            'font-family': theme.monoFamily,
          },
          escapeXml(`${m.visibility} ${m.text}`)
        )
      );
    });
  }

  return wrapSvg(totalWidth, totalHeight, theme, parts.join('\n'), ast.title);
}
