<script lang="ts">
  import type { ConnectionStatus } from "../lib/wsClient";
  import type { Player } from "../lib/types";

  let {
    currentPlayer,
    round = 1,
    connectionStatus = "disconnected",
  }: {
    currentPlayer: Player | null;
    round?: number;
    connectionStatus?: ConnectionStatus;
  } = $props();
</script>

{#if connectionStatus === "reconnecting"}
  <div class="reconnect-banner">Connection lost. Reconnecting...</div>
{:else if connectionStatus === "disconnected"}
  <div class="reconnect-banner">Disconnected. Please check your connection.</div>
{/if}

<div class="turn-indicator card">
  {#if currentPlayer}
    <div class="player-name">{currentPlayer.name}</div>
    <div class="round-info">Round {round}</div>
  {:else}
    <div class="waiting">Waiting for players...</div>
  {/if}
</div>
