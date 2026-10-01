<script lang="ts">
  import type { PlayerView } from "../lib/types";

  let {
    players = [],
    isDM = false,
    myPlayerId = null,
    currentPlayer,
    onRemovePlayer,
    onReorderPlayers,
  }: {
    players: PlayerView[];
    isDM?: boolean;
    myPlayerId?: string | null;
    currentPlayer: PlayerView | null;
    onRemovePlayer?: (playerId: string) => void;
    onReorderPlayers?: (orderedPlayerIds: string[]) => void;
  } = $props();

  // The server sends players in turn order; swap neighbours and send the full new order.
  function swap(a: number, b: number) {
    const ids = players.map((p) => p.id);
    [ids[a], ids[b]] = [ids[b]!, ids[a]!];
    onReorderPlayers?.(ids);
  }
</script>

{#if players.length === 0}
  <p class="empty-state">
    {isDM ? "No one yet. Share the room code, or add NPCs below." : "Waiting for players to join..."}
  </p>
{:else}
  <ul class="player-list">
    {#each players as player, i (player.id)}
      <li class="player-row" class:current-turn={currentPlayer?.id === player.id}>
        <span class="initiative">{player.initiative}</span>
        <span class="name">
          {player.name}
          {#if isDM && player.isNpc}
            <span class="badge">NPC</span>
          {/if}
          {#if player.id === myPlayerId}
            <span class="badge">You</span>
          {/if}
        </span>
        {#if isDM}
          <div class="controls">
            <button
              class="btn-icon btn-ghost"
              onclick={() => swap(i - 1, i)}
              disabled={i === 0}
              aria-label="Move {player.name} up"
            >&#9650;</button>
            <button
              class="btn-icon btn-ghost"
              onclick={() => swap(i, i + 1)}
              disabled={i === players.length - 1}
              aria-label="Move {player.name} down"
            >&#9660;</button>
            <button
              class="btn-icon btn-danger"
              onclick={() => onRemovePlayer?.(player.id)}
              aria-label="Remove {player.name}"
            >&#10005;</button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
