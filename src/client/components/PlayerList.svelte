<script lang="ts">
  import type { Player } from "../lib/types";

  let {
    players = [],
    isDM = false,
    currentPlayer,
    onRemovePlayer,
    onReorderPlayers,
  }: {
    players: Player[];
    isDM?: boolean;
    currentPlayer: Player | null;
    onRemovePlayer?: (playerId: string) => void;
    onReorderPlayers?: (orderedPlayerIds: string[]) => void;
  } = $props();

  let sorted = $derived([...players].sort((a, b) => a.sortOrder - b.sortOrder));

  function moveUp(index: number) {
    if (index === 0) return;
    const ids = sorted.map((p) => p.id);
    [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
    onReorderPlayers?.(ids);
  }

  function moveDown(index: number) {
    if (index >= sorted.length - 1) return;
    const ids = sorted.map((p) => p.id);
    [ids[index], ids[index + 1]] = [ids[index + 1]!, ids[index]!];
    onReorderPlayers?.(ids);
  }
</script>

{#if sorted.length === 0}
  <p class="empty-state">No players yet. Waiting for players to join...</p>
{:else}
  <ul class="player-list">
    {#each sorted as player, i (player.id)}
      <li
        class="player-row"
        class:current-turn={currentPlayer?.id === player.id}
      >
        <span class="initiative">{player.initiative}</span>
        <span class="name">
          {player.name}
          {#if player.isDM}
            <span class="dm-badge">DM</span>
          {/if}
        </span>
        {#if isDM && !player.isDM}
          <div class="controls">
            <button
              class="btn-icon btn-ghost"
              onclick={() => moveUp(i)}
              disabled={i === 0}
              aria-label="Move up"
            >&#9650;</button>
            <button
              class="btn-icon btn-ghost"
              onclick={() => moveDown(i)}
              disabled={i === sorted.length - 1}
              aria-label="Move down"
            >&#9660;</button>
            <button
              class="btn-icon btn-danger"
              onclick={() => onRemovePlayer?.(player.id)}
              aria-label="Remove player"
            >&#10005;</button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
