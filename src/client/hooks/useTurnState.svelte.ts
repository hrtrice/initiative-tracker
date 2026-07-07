import type { Player, TurnState } from "@shared/types";

export function createTurnDerived(players: () => Player[], turnState: () => TurnState | null) {
  let currentPlayer = $derived.by(() => {
    const ts = turnState();
    if (!ts) return null;
    const allPlayers = players();
    return allPlayers[ts.currentIndex] ?? null;
  });

  let isWrapping = $derived.by(() => {
    const cp = currentPlayer;
    if (!cp) return false;
    const allPlayers = players();
    const ts = turnState();
    if (!ts) return false;
    return cp.sortOrder === allPlayers[0]?.sortOrder && ts.round > 1;
  });

  return {
    get currentPlayer() {
      return currentPlayer;
    },
    get isWrapping() {
      return isWrapping;
    },
  };
}
