import { describe, expect, it } from 'vitest';
import { createEngine } from './engine';
import type { EngineDeps } from './deps';

function makeDeps(): EngineDeps {
  let id = 0;
  return { random: () => 0, nextId: () => `d${++id}`, now: () => 1000 };
}

describe('game session', () => {
  it('restores the current state and both undo/redo stacks', () => {
    const source = createEngine(makeDeps());
    source.dispatch({ type: 'add', count: 2, values: [6, 4] });
    source.dispatch({ type: 'select', ids: ['d1'], mode: 'set' });
    source.dispatch({ type: 'move', targetValue: 5 });
    source.dispatch({ type: 'undo' });

    const snapshot = source.exportSession();
    expect(source.canRedo()).toBe(true);
    expect(source.canUndo()).toBe(true);

    const restored = createEngine(makeDeps());
    restored.restoreSession(snapshot);

    // Check that we can redo to get the moved state
    restored.dispatch({ type: 'redo' });
    expect(restored.getState().dice.map((die) => die.value)).toEqual([5, 4]);
    
    // Check that we can undo back to the original state
    restored.dispatch({ type: 'undo' });
    expect(restored.getState().dice.map((die) => die.value)).toEqual([6, 4]);
    
     // Check that selection is preserved
     const selection = restored.getState().selection;
     expect(selection.kind).toBe('ids');
     if (selection.kind === 'ids') {
       expect(Array.from(selection.ids)[0]).toBe('d1');
     }
    
    // Check that we can still undo/redo appropriately
    expect(restored.canUndo()).toBe(true);  // Can undo the redo we just did
    expect(restored.canRedo()).toBe(true);  // Can redo the undo we just did
  });
});