import { resolveTheme } from '../themes.js';
import { renderSequence } from './sequence.js';
import { renderClass } from './class.js';
import { renderFlow } from './flow.js';

/**
 * Render a parsed MarkUML AST into an SVG string.
 * @param {ReturnType<import('../parser/index.js').parseUML>} ast
 * @param {{ theme?: 'light' | 'dark' | Record<string, any> }} [options]
 * @returns {string}
 */
export function renderAST(ast, options = {}) {
  const theme = resolveTheme(options.theme);
  switch (ast.type) {
    case 'class':
      return renderClass(ast, theme);
    case 'flow':
      return renderFlow(ast, theme);
    case 'sequence':
    default:
      return renderSequence(ast, theme);
  }
}
