import { parseUML } from './parser/index.js';
import { renderAST } from './renderer/index.js';
import { THEMES, resolveTheme } from './themes.js';

export { parseUML, renderAST, THEMES, resolveTheme };

/**
 * Parse and render Markdown-like UML syntax into an SVG string.
 * @param {string} source
 * @param {{ type?: 'sequence' | 'class' | 'flow', theme?: 'light' | 'dark' | Record<string, any> }} [options]
 * @returns {string}
 */
export function renderSVG(source, options = {}) {
  const ast = parseUML(source, options);
  return renderAST(ast, options);
}

/**
 * Parse and render Markdown-like UML syntax, returning both SVG and AST.
 * @param {string} source
 * @param {{ type?: 'sequence' | 'class' | 'flow', theme?: 'light' | 'dark' | Record<string, any> }} [options]
 */
export function renderUML(source, options = {}) {
  const ast = parseUML(source, options);
  const svg = renderAST(ast, options);
  return { svg, ast, type: ast.type };
}

/**
 * Mount a rendered UML diagram into a DOM element (for browser usage).
 * @param {HTMLElement | string} target
 * @param {string} source
 * @param {{ type?: 'sequence' | 'class' | 'flow', theme?: 'light' | 'dark' | Record<string, any> }} [options]
 */
export function mountUML(target, source, options = {}) {
  const el =
    typeof target === 'string'
      ? globalThis.document?.querySelector(target)
      : target;

  if (!el) {
    throw new Error('MarkUML: target DOM element not found.');
  }

  const result = renderUML(source, options);
  el.innerHTML = result.svg;
  return result;
}

/**
 * Transform ```uml or ```markuml fenced code blocks inside a Markdown string into inline SVG blocks.
 * @param {string} markdown
 * @param {{ theme?: 'light' | 'dark' | Record<string, any>, wrapperClass?: string }} [options]
 * @returns {string}
 */
export function renderMarkdownBlocks(markdown, options = {}) {
  if (typeof markdown !== 'string') {
    throw new TypeError('MarkUML: markdown input must be a string.');
  }
  const wrapperClass = options.wrapperClass || 'markuml-diagram';
  const fenceRegex = /^```(?:markuml|uml)\s*\r?\n([\s\S]*?)^```\s*$/gm;
  return markdown.replace(fenceRegex, (_match, body) => {
    const svg = renderSVG(body, options);
    return `<div class="${wrapperClass}">\n${svg}\n</div>`;
  });
}
