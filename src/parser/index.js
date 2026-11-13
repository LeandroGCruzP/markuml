import { parseUseCase } from './usecase.js';

/**
 * Parse Markdown-like UML text into a Use Case Diagram AST.
 * @param {string} source
 */
export function parseUML(source, options = {}) {
  if (typeof source !== 'string') {
    throw new TypeError('MarkUML: source must be a string.');
  }

  const lines = source.split(/\r?\n/);
  return parseUseCase(lines, '', options);
}
