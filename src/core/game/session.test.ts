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

    expect(restored.getState()).toEqual(source.getState());
    expect(restored.canUndo()).toBe(source.canUndo());
    expect(restored.canRedo()).toBe(source.canRedo());

    restored.dispatch({ type: 'redo' });
    expect(restored.getState().dice.map((die) => die.value)).toEqual([5, 4]);
    restored.dispatch({ type: 'undo' });
    expect(restored.getState()).toEqual(source.getState());
  });
});
