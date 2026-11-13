import { el, escapeXml, measureText, wrapSvg } from '../svg.js';

/**
 * Compute layered coordinates for flowchart nodes.
 * @param {Array<any>} nodes
 * @param {Array<any>} edges
 * @param {import('../themes.js').THEMES.light} theme
 */
function layoutFlow(nodes, edges, theme) {
  const inDegree = new Map(nodes.map((n) => [n.id, 0]));
  const adj = new Map(nodes.map((n) => [n.id, []]));

  for (const e of edges) {
    if (adj.has(e.from) && inDegree.has(e.to)) {
      adj.get(e.from).push(e.to);
      inDegree.set(e.to, inDegree.get(e.to) + 1);
    }
  }

  const roots = nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
  if (roots.length === 0 && nodes.length > 0) roots.push(nodes[0].id);

  const layerOf = new Map();
  const queue = [];
  for (const r of roots) {
    layerOf.set(r, 0);
    queue.push(r);
  }

  while (queue.length > 0) {
    const curr = queue.shift();
    const currLayer = layerOf.get(curr);
    for (const next of adj.get(curr) || []) {
      if (!layerOf.has(next)) {
        layerOf.set(next, currLayer + 1);
        queue.push(next);
      }
    }
  }

  // Ensure any disconnected nodes still get a layer
  for (const n of nodes) {
    if (!layerOf.has(n.id)) layerOf.set(n.id, 0);
  }

  const layers = [];
  for (const n of nodes) {
    const l = layerOf.get(n.id);
    if (!layers[l]) layers[l] = [];
    const textW = measureText(n.label, theme.fontSize);
    const width =
      n.shape === 'decision'
        ? Math.max(120, Math.ceil(textW + 64))
        : Math.max(110, Math.ceil(textW + 36));
    const height = n.shape === 'decision' ? 56 : 40;
    layers[l].push({ ...n, layer: l, width, height });
  }

  return { layers, layerOf };
}

/**
 * Render a parsed flowchart AST into an SVG string.
 * @param {ReturnType<import('../parser/flow.js').parseFlow>} ast
 * @param {import('../themes.js').THEMES.light} theme
 * @returns {string}
 */
export function renderFlow(ast, theme) {
  const pad = theme.padding;
  const titleHeight = ast.title ? 34 : 0;

  if (ast.nodes.length === 0) {
    const emptyText = el(
      'text',
      { x: pad, y: pad + 18, fill: theme.mutedText, 'font-size': theme.fontSize },
      'Empty flowchart'
    );
    return wrapSvg(240, 80, theme, emptyText, ast.title);
  }

  const { layers, layerOf } = layoutFlow(ast.nodes, ast.edges, theme);
  const hGap = 48;
  const vGap = 54;

  const layerWidths = layers.map(
    (row) => row.reduce((sum, n) => sum + n.width, 0) + Math.max(0, row.length - 1) * hGap
  );
  const maxRowWidth = Math.max(...layerWidths, 180);
  const totalWidth = maxRowWidth + pad * 2;

  const nodeMap = new Map();
  let cursorY = pad + titleHeight;

  for (const row of layers) {
    const rowW = row.reduce((sum, n) => sum + n.width, 0) + Math.max(0, row.length - 1) * hGap;
    const rowH = Math.max(...row.map((n) => n.height));
    let cursorX = (totalWidth - rowW) / 2;

    for (const node of row) {
      node.x = cursorX;
      node.y = cursorY + (rowH - node.height) / 2;
      node.cx = node.x + node.width / 2;
      node.cy = node.y + node.height / 2;
      nodeMap.set(node.id, node);
      cursorX += node.width + hGap;
    }
    cursorY += rowH + vGap;
  }

  const totalHeight = cursorY - vGap + pad;
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

  // Draw edges
  for (const edge of ast.edges) {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) continue;

    const fromL = layerOf.get(from.id);
    const toL = layerOf.get(to.id);
    const dashed = edge.dashed ? '6,4' : undefined;

    let d;
    let labelX;
    let labelY;

    if (toL > fromL) {
      const startX = from.cx;
      const startY = from.y + from.height;
      const endX = to.cx;
      const endY = to.y - 2;
      const midY = (startY + endY) / 2;
      d = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
      labelX = (startX + endX) / 2;
      labelY = midY;
    } else {
      // Back-edge or same-layer edge: curve around the right side
      const startX = from.x + from.width;
      const startY = from.cy;
      const endX = to.x + to.width + 2;
      const endY = to.cy;
      const offset = Math.max(from.x + from.width, to.x + to.width) + 48;
      d = `M ${startX} ${startY} C ${offset} ${startY}, ${offset} ${endY}, ${endX} ${endY}`;
      labelX = offset - 10;
      labelY = (startY + endY) / 2;
    }

    parts.push(
      el('path', {
        d,
        fill: 'none',
        stroke: theme.edgeStroke,
        'stroke-width': 1.5,
        'stroke-dasharray': dashed,
        'marker-end': 'url(#uml-arrow)',
      })
    );

    if (edge.label) {
      const lw = measureText(edge.label, theme.fontSize - 1) + 12;
      parts.push(
        el('rect', {
          x: labelX - lw / 2,
          y: labelY - 9,
          width: lw,
          height: 18,
          rx: 4,
          fill: theme.labelBg,
        })
      );
      parts.push(
        el(
          'text',
          {
            x: labelX,
            y: labelY + 4,
            'text-anchor': 'middle',
            fill: theme.mutedText,
            'font-size': theme.fontSize - 1,
            'font-weight': '500',
          },
          escapeXml(edge.label)
        )
      );
    }
  }

  // Draw nodes
  for (const node of nodeMap.values()) {
    if (node.shape === 'terminal') {
      parts.push(
        el('rect', {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          rx: node.height / 2,
          fill: theme.terminalFill,
          stroke: theme.terminalStroke,
          'stroke-width': 1.6,
        })
      );
    } else if (node.shape === 'decision') {
      const top = `${node.cx},${node.y}`;
      const right = `${node.x + node.width},${node.cy}`;
      const bottom = `${node.cx},${node.y + node.height}`;
      const left = `${node.x},${node.cy}`;
      parts.push(
        el('polygon', {
          points: `${top} ${right} ${bottom} ${left}`,
          fill: theme.decisionFill,
          stroke: theme.decisionStroke,
          'stroke-width': 1.6,
          'stroke-linejoin': 'round',
        })
      );
    } else {
      parts.push(
        el('rect', {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          rx: theme.borderRadius,
          fill: theme.accentFill,
          stroke: theme.accentStroke,
          'stroke-width': 1.5,
        })
      );
    }

    parts.push(
      el(
        'text',
        {
          x: node.cx,
          y: node.cy + 4.5,
          'text-anchor': 'middle',
          fill: theme.text,
          'font-size': theme.fontSize,
          'font-weight': '500',
        },
        escapeXml(node.label)
      )
    );
  }

  return wrapSvg(totalWidth, totalHeight, theme, parts.join('\n'), ast.title);
}
