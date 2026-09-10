import type { GameState } from '../core/game/state';
import type { HistoryEntry } from '../core/history/types';
import type { Selection } from '../core/selection/selection';

const SHARE_PREFIX = 'share=';
const SHARE_VERSION = 2;

interface SharedRollV1 {
  v: 1;
  dice: number[];
}

interface SharedSelection {
  kind: 'none' | 'range' | 'ids';
  min?: number;
  max?: number;
  indices?: number[];
}

interface SharedRollV2 {
  v: 2;
  dice: number[];
  history: HistoryEntry[];
  selection: SharedSelection;
}

function toBase64Url(value: string): string {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(value: string): string {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

function encodeSelection(state: GameState): SharedSelection {
  switch (state.selection.kind) {
    case 'range':
      return { kind: 'range', min: state.selection.min, max: state.selection.max };
    case 'ids': {
      const indices = state.dice
        .map((die, index) => (state.selection.ids.has(die.id) ? index : -1))
        .filter((index) => index >= 0);
      return { kind: 'ids', indices };
    }
    default:
      return { kind: 'none' };
  }
}

function decodeSelection(selection: SharedSelection | undefined, diceIds: string[]): Selection {
  if (!selection || selection.kind === 'none') return { kind: 'none' };
  if (selection.kind === 'range' && Number.isInteger(selection.min) && Number.isInteger(selection.max)) {
    return { kind: 'range', min: selection.min!, max: selection.max! };
  }
  if (selection.kind === 'ids' && Array.isArray(selection.indices)) {
    const ids = new Set(
      selection.indices
        .filter((index): index is number => Number.isInteger(index) && index >= 0 && index < diceIds.length)
        .map((index) => diceIds[index]),
    );
    return ids.size > 0 ? { kind: 'ids', ids } : { kind: 'none' };
  }
  return { kind: 'none' };
}

function makeDice(values: number[]): GameState['dice'] {
  return values
    .filter((value): value is number => Number.isInteger(value) && value >= 1 && value <= 6)
    .map((value, index) => ({
      id: `shared-${index}`,
      type: 'd6' as const,
      value,
      origin: 'roll' as const,
    }));
}

export function createShareUrl(state: GameState): string {
  const payload: SharedRollV2 = {
    v: SHARE_VERSION,
    dice: state.dice.map((die) => die.value),
    history: state.history,
    selection: encodeSelection(state),
  };
  const url = new URL(window.location.href);
  url.hash = `${SHARE_PREFIX}${toBase64Url(JSON.stringify(payload))}`;
  return url.toString();
}

export function readSharedState(): GameState | null {
  if (typeof window === 'undefined' || !window.location.hash.startsWith(`#${SHARE_PREFIX}`)) {
    return null;
  }

  try {
    const encoded = window.location.hash.slice(SHARE_PREFIX.length + 1);
    const payload = JSON.parse(fromBase64Url(encoded)) as Partial<SharedRollV1 | SharedRollV2>;

    if (payload.v === 1 && Array.isArray(payload.dice)) {
      const dice = makeDice(payload.dice);
      return {
        dice,
        history: [],
        selection: { kind: 'none' },
      };
    }

    if (
      payload.v !== SHARE_VERSION ||
      !Array.isArray(payload.dice) ||
      !Array.isArray(payload.history)
    ) {
      return null;
    }

    const dice = makeDice(payload.dice);
    const history = payload.history.filter(isHistoryEntry);
    const diceIds = dice.map((die) => die.id);

    return {
      dice,
      history,
      selection: decodeSelection(payload.selection, diceIds),
    };
  } catch {
    return null;
  }
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<HistoryEntry>;
  return (
    typeof entry.id === 'string' &&
    Number.isFinite(entry.timestamp) &&
    (entry.kind === 'roll' ||
      entry.kind === 'reroll' ||
      entry.kind === 'add' ||
      entry.kind === 'delete' ||
      entry.kind === 'move' ||
      entry.kind === 'clear') &&
    Number.isInteger(entry.count)
  );
}

export async function shareRollState(state: GameState): Promise<'shared' | 'copied' | 'failed'> {
  const url = createShareUrl(state);
  const shareData = {
    title: 'DiceFlow Roll',
    text: 'DiceFlow roll state',
    url,
  };

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'failed';
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
