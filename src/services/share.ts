import type { GameState } from '../core/game/state';

const SHARE_PREFIX = 'share=';
const SHARE_VERSION = 1;

interface SharedRoll {
  v: number;
  dice: number[];
}

function toBase64Url(value: string): string {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(value: string): string {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

export function createShareUrl(state: GameState): string {
  const payload: SharedRoll = {
    v: SHARE_VERSION,
    dice: state.dice.map((die) => die.value),
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
    const payload = JSON.parse(fromBase64Url(encoded)) as Partial<SharedRoll>;
    if (payload.v !== SHARE_VERSION || !Array.isArray(payload.dice)) return null;

    const dice = payload.dice
      .filter((value): value is number => Number.isInteger(value) && value >= 1 && value <= 6)
      .map((value, index) => ({
        id: `shared-${index}`,
        type: 'd6' as const,
        value,
        origin: 'roll' as const,
      }));

    return {
      dice,
      history: [],
      selection: { kind: 'none' },
    };
  } catch {
    return null;
  }
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
