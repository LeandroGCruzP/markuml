/**
 * Lightweight SVG generation helpers with zero dependencies.
 */

const XML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape special XML characters for safe SVG text and attributes.
 * @param {string} value
 * @returns {string}
 */
export function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => XML_ENTITIES[ch]);
}

/**
 * Estimate rendered text width in pixels for layout calculations.
 * @param {string} text
 * @param {number} [fontSize=13]
 * @param {boolean} [isMono=false]
 * @returns {number}
 */
export function measureText(text, fontSize = 13, isMono = false) {
  const str = String(text ?? '');
  if (!str) return 0;
  if (isMono) {
    return str.length * fontSize * 0.62;
  }
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if ('ilIj.,:;\'!| '.includes(ch)) {
      width += fontSize * 0.34;
    } else if ('mwMW@%'.includes(ch)) {
      width += fontSize * 0.82;
    } else if (ch >= 'A' && ch <= 'Z') {
      width += fontSize * 0.68;
    } else {
      width += fontSize * 0.56;
    }
  }
  return width;
}

/**
 * Format SVG attributes from an object, omitting null/undefined values.
 * @param {Record<string, string | number | undefined | null>} attrs
 * @returns {string}
 */
export function formatAttrs(attrs) {
  return Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}="${escapeXml(v)}"`)
    .join(' ');
}

/**
 * Create an SVG element string.
 * @param {string} tag
 * @param {Record<string, string | number | undefined | null>} attrs
 * @param {string} [children='']
 * @returns {string}
 */
export function el(tag, attrs = {}, children = '') {
  const attrStr = formatAttrs(attrs);
  const open = attrStr ? `<${tag} ${attrStr}` : `<${tag}`;
  if (!children) {
    return `${open} />`;
  }
  return `${open}>${children}</${tag}>`;
}

/**
 * Build standard UML markers (arrow, open-arrow, inheritance, composition, aggregation).
 * @param {string} strokeColor
 * @param {string} fillColor
 * @returns {string}
 */
export function buildDefs(strokeColor, fillColor) {
  return el('defs', {}, [
    // Solid filled arrow
    el(
      'marker',
      {
        id: 'uml-arrow',
        viewBox: '0 0 10 10',
        refX: 9,
        refY: 5,
        markerWidth: 7,
        markerHeight: 7,
        orient: 'auto-start-reverse',
      },
      el('path', { d: 'M 0 1.5 L 9 5 L 0 8.5 z', fill: strokeColor })
    ),
    // Open chevron arrow
    el(
      'marker',
      {
        id: 'uml-open-arrow',
        viewBox: '0 0 10 10',
        refX: 9,
        refY: 5,
        markerWidth: 7,
        markerHeight: 7,
        orient: 'auto-start-reverse',
      },
      el('path', {
        d: 'M 1 1.5 L 9 5 L 1 8.5',
        fill: 'none',
        stroke: strokeColor,
        'stroke-width': 1.6,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      })
    ),
    // Hollow triangle (inheritance / implementation)
    el(
      'marker',
      {
        id: 'uml-triangle',
        viewBox: '0 0 12 12',
        refX: 11,
        refY: 6,
        markerWidth: 9,
        markerHeight: 9,
        orient: 'auto-start-reverse',
      },
      el('path', {
        d: 'M 1 1.5 L 11 6 L 1 10.5 z',
        fill: fillColor,
        stroke: strokeColor,
        'stroke-width': 1.5,
        'stroke-linejoin': 'round',
      })
    ),
    // Filled diamond (composition)
    el(
      'marker',
      {
        id: 'uml-diamond-filled',
        viewBox: '0 0 14 10',
        refX: 1,
        refY: 5,
        markerWidth: 10,
        markerHeight: 8,
        orient: 'auto-start-reverse',
      },
      el('path', {
        d: 'M 1 5 L 7 1 L 13 5 L 7 9 z',
        fill: strokeColor,
        stroke: strokeColor,
        'stroke-width': 1.2,
      })
    ),
    // Hollow diamond (aggregation)
    el(
      'marker',
      {
        id: 'uml-diamond-hollow',
        viewBox: '0 0 14 10',
        refX: 1,
        refY: 5,
        markerWidth: 10,
        markerHeight: 8,
        orient: 'auto-start-reverse',
      },
      el('path', {
        d: 'M 1 5 L 7 1 L 13 5 L 7 9 z',
        fill: fillColor,
        stroke: strokeColor,
        'stroke-width': 1.4,
      })
    ),
  ].join('\n'));
}

/**
 * Wrap body elements in a root <svg> container.
 * @param {number} width
 * @param {number} height
 * @param {import('./themes.js').THEMES.light} theme
 * @param {string} body
 * @param {string} [title]
 * @returns {string}
 */
export function wrapSvg(width, height, theme, body, title) {
  const w = Math.max(100, Math.ceil(width));
  const h = Math.max(60, Math.ceil(height));
  const bg = el('rect', {
    x: 0,
    y: 0,
    width: w,
    height: h,
    rx: theme.borderRadius,
    fill: theme.background,
  });
  const titleEl = title ? el('title', {}, escapeXml(title)) : '';
  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${w} ${h}`,
      width: w,
      height: h,
      role: 'img',
      'aria-label': title || 'UML Diagram',
      style: `font-family: ${theme.fontFamily}; max-width: 100%; height: auto;`,
    },
    [titleEl, buildDefs(theme.edgeStroke, theme.background), bg, body].filter(Boolean).join('\n')
  );
}
