import { resolveTheme } from '../themes.js';
import { renderUseCase } from './usecase.js';

/**
 * Render a parsed MarkUML AST into an SVG string.
 * @param {ReturnType<import('../parser/usecase.js').parseUseCase>} ast
 * @param {{ theme?: 'light' | 'dark' | Record<string, any> }} [options]
 * @returns {string}
 */
export function renderAST(ast, options = {}) {
  const theme = resolveTheme(options.theme);
  return renderUseCase(ast, theme, options);
}
