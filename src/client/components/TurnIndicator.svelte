<script lang="ts">
  import type { ConnectionStatus } from "../lib/wsClient";
  import type { PlayerView } from "../lib/types";

  let {
    currentPlayer,
    round = 1,
    isDM = false,
    myPlayerId = null,
    connectionStatus = "disconnected",
  }: {
    currentPlayer: PlayerView | null;
    round?: number;
    isDM?: boolean;
    myPlayerId?: string | null;
    connectionStatus?: ConnectionStatus;
  } = $props();

  let hasConnected = $state(false);

  $effect(() => {
    if (connectionStatus === "connected") {
      hasConnected = true;
    }
  });
</script>

{#if hasConnected}
  {#if connectionStatus === "reconnecting"}
    <div class="reconnect-banner">Connection lost. Reconnecting...</div>
  {:else if connectionStatus === "disconnected"}
    <div class="reconnect-banner">Disconnected. Please check your connection.</div>
  {/if}
{/if}

<div class="turn-indicator card">
  {#if currentPlayer}
    <div class="player-name">{currentPlayer.name}</div>
    {#if isDM && currentPlayer.isNpc}
      <div class="turn-note">NPC turn: you're up</div>
    {:else if currentPlayer.id === myPlayerId}
      <div class="turn-note">Your turn!</div>
    {/if}
    <div class="round-info">Round {round}</div>
  {:else}
    <div class="waiting">Waiting for players...</div>
  {/if}
</div>
