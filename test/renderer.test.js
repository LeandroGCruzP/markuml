import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderSVG, renderUML, THEMES } from '../src/index.js';

describe('renderSVG / renderUML - Use Case Diagrams', () => {
  it('renders a valid use case SVG with stick figures, dot grid, and use case pills', () => {
    const svg = renderSVG(`
# usecase: AÇÕES EM LOTE

## actors
- Administrador
- Supervisor
- Operador

## relations
- Administrador --|> Supervisor
- Supervisor --|> Operador

## cases
- Supervisor -> (Excluir múltiplos chamados de uma vez)
- Operador -> (Cancelar múltiplos chamados de uma vez)
- Operador -> (Finalizar múltiplos chamados de uma vez)
`, { theme: 'dark' });

    assert.ok(svg.startsWith('<svg '));
    assert.ok(svg.endsWith('</svg>'));
    assert.ok(svg.includes('AÇÕES EM LOTE'));
    assert.ok(svg.includes('markuml-dot-grid'));
    assert.ok(svg.includes('Administrador'));
    assert.ok(svg.includes('Supervisor'));
    assert.ok(svg.includes('Operador'));
    assert.ok(svg.includes('Excluir múltiplos chamados'));
    assert.ok(svg.includes('de uma vez'));
  });
});
