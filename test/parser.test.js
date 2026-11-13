import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseUML } from '../src/index.js';

describe('parseUML - Use Case Diagram', () => {
  it('strictly respects exact actor names and case sensitivity', () => {
    const src = `
# usecase: AÇÕES EM LOTE

## actors
- Admin
- admin
- Supervisor
- Operator
- Externo
- Externo2

## relations
- Admin --|> Supervisor
- admin --|> Supervisor
- Externo --|> Supervisor
- Externo2 --|> Supervisor
- Supervisor --|> Operator

## cases
- Operator -> (List users)
- Supervisor -> (Excluir múltiplos chamados de uma vez)
- UndeclaredActor -> (Fail case)
`;
    const ast = parseUML(src);
    assert.equal(ast.type, 'usecase');
    assert.equal(ast.title, 'AÇÕES EM LOTE');
    // Admin, admin, Supervisor, Operator, Externo, Externo2 are all distinct!
    assert.equal(ast.actors.length, 6);
    assert.equal(ast.actors.map((a) => a.id).includes('Admin'), true);
    assert.equal(ast.actors.map((a) => a.id).includes('admin'), true);
    assert.equal(ast.actors.map((a) => a.id).includes('Externo'), true);
    assert.equal(ast.actors.map((a) => a.id).includes('Externo2'), true);

    // UndeclaredActor is rejected and recorded as an error
    assert.equal(ast.errors.length, 1);
    assert.equal(ast.errors[0].actor, 'UndeclaredActor');
    assert.equal(ast.useCases.length, 2);
  });
});
