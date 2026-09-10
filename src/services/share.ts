import type { GameSession } from '../core/game/engine';
import type { GameState } from '../core/game/state';
import type { HistoryEntry } from '../core/history/types';
import { isD6Value, type Die } from '../core/dice/types';
import type { Selection } from '../core/selection/selection';

const SHARE_PREFIX = 'share=';
const SHARE_VERSION = 3;

interface SharedRollV1 { v: 1; dice: number[]; }
interface SharedStateV2 { v: 2; dice: number[]; history: HistoryEntry[]; selection?: SharedSelection; }
interface SharedSelection { kind: 'none' | 'range' | 'ids'; min?: number; max?: number; indices?: number[]; }
interface SharedStateV3 { dice: Die[]; history: HistoryEntry[]; selection: SharedSelection; }
interface SharedSessionV3 { v: 3; state: SharedStateV3; undo: SharedStateV3[]; redo: SharedStateV3[]; }

function toBase64Url(value: string): string {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(value: string): string {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  return atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
}

function encodeSelection(state: GameState): SharedSelection {
  switch (state.selection.kind) {
    case 'range': return { kind: 'range', min: state.selection.min, max: state.selection.max };
    case 'ids': return { kind: 'ids', indices: state.dice.map((die, index) => state.selection.ids.has(die.id) ? index : -1).filter((index) => index >= 0) };
    default: return { kind: 'none' };
  }
}

function decodeSelection(selection: SharedSelection | undefined, dice: Die[]): Selection {
  if (!selection || selection.kind === 'none') return { kind: 'none' };
  if (selection.kind === 'range' && Number.isInteger(selection.min) && Number.isInteger(selection.max)) {
    return { kind: 'range', min: selection.min!, max: selection.max! };
  }
  if (selection.kind === 'ids' && Array.isArray(selection.indices)) {
    const ids = new Set(selection.indices.filter((index): index is number => Number.isInteger(index) && index >= 0 && index < dice.length).map((index) => dice[index].id));
    return ids.size ? { kind: 'ids', ids } : { kind: 'none' };
  }
  return { kind: 'none' };
}

function encodeState(state: GameState): SharedStateV3 {
  return { dice: state.dice, history: state.history, selection: encodeSelection(state) };
}

function decodeState(raw: SharedStateV3): GameState | null {
  if (!raw || !Array.isArray(raw.dice) || !Array.isArray(raw.history)) return null;
  const dice = raw.dice.filter((die): die is Die => Boolean(die) && typeof die === 'object' && typeof die.id === 'string' && die.type === 'd6' && isD6Value(die.value) && (die.origin === 'roll' || die.origin === 'reroll' || die.origin === 'add' || die.origin === 'move'));
  if (dice.length !== raw.dice.length || !raw.history.every(isHistoryEntry)) return null;
  return { dice, history: raw.history, selection: decodeSelection(raw.selection, dice) };
}

function makeDice(values: number[]): GameState['dice'] {
  return values.filter(isD6Value).map((value, index) => ({ id: `shared-${index}`, type: 'd6' as const, value, origin: 'roll' as const }));
}

export function createShareUrl(session: GameSession): string {
  const payload: SharedSessionV3 = { v: SHARE_VERSION, state: encodeState(session.state), undo: session.undo.map(encodeState), redo: session.redo.map(encodeState) };
  const url = new URL(window.location.href);
  url.hash = `${SHARE_PREFIX}${toBase64Url(JSON.stringify(payload))}`;
  return url.toString();
}

export function readSharedSession(): GameSession | null {
  if (typeof window === 'undefined' || !window.location.hash.startsWith(`#${SHARE_PREFIX}`)) return null;
  try {
    const encoded = window.location.hash.slice(SHARE_PREFIX.length + 1);
    const payload = JSON.parse(fromBase64Url(encoded)) as Partial<SharedRollV1 | SharedStateV2 | SharedSessionV3>;

    if (payload.v === 1 && Array.isArray(payload.dice)) {
      const dice = makeDice(payload.dice);
      return { state: { dice, history: [], selection: { kind: 'none' } }, undo: [], redo: [] };
    }

    if (payload.v === 2 && Array.isArray(payload.dice) && Array.isArray(payload.history)) {
      const dice = makeDice(payload.dice);
      const history = payload.history.filter(isHistoryEntry);
      return { state: { dice, history, selection: decodeSelection(payload.selection, dice) }, undo: [], redo: [] };
    }

    if (payload.v !== SHARE_VERSION || !payload.state || !Array.isArray(payload.undo) || !Array.isArray(payload.redo)) return null;
    const state = decodeState(payload.state);
    if (!state) return null;
    const undo: GameState[] = [];
    for (const raw of payload.undo) {
      const decoded = decodeState(raw);
      if (!decoded) return null;
      undo.push(decoded);
    }
    const redo: GameState[] = [];
    for (const raw of payload.redo) {
      const decoded = decodeState(raw);
      if (!decoded) return null;
      redo.push(decoded);
    }
    return { state, undo, redo };
  } catch {
    return null;
  }
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<HistoryEntry>;
  return typeof entry.id === 'string' && Number.isFinite(entry.timestamp) && ['roll', 'reroll', 'add', 'delete', 'move', 'clear'].includes(entry.kind ?? '') && Number.isInteger(entry.count);
}

export async function shareSession(session: GameSession): Promise<'shared' | 'copied' | 'failed'> {
  const url = createShareUrl(session);
  const shareData = { title: 'DiceFlow Session', text: 'DiceFlow session', url };
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
