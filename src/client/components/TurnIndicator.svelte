<script lang="ts">
  import type { ConnectionStatus } from "../lib/wsClient";
  import type { PlayerView } from "../lib/types";
  import { toRoman } from "../lib/roman";

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
    <div class="reconnect-banner">The torch gutters… reconnecting.</div>
  {:else if connectionStatus === "disconnected"}
    <div class="reconnect-banner">Lost touch with the table. Check your connection.</div>
  {/if}
{/if}

<div class="turn-indicator card">
  {#if currentPlayer}
    <div class="player-name">{currentPlayer.name}</div>
    {#if isDM && currentPlayer.isNpc}
      <div class="turn-note">The foe stirs. Your move, Dungeon Master.</div>
    {:else if currentPlayer.id === myPlayerId}
      <div class="turn-note">Your move, adventurer!</div>
    {/if}
    <!-- Screen readers get the plain number; "Round I I I" is no help to a listener. -->
    <div class="round-info">
      <span aria-hidden="true">Round {toRoman(round)}</span>
      <span class="visually-hidden">Round {round}</span>
    </div>
  {:else}
    <div class="waiting">The party gathers…</div>
  {/if}
</div>
