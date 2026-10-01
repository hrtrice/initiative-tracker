<script lang="ts">
  import { createSessionState } from "./hooks/useSession.svelte";
  import Lobby from "./components/Lobby.svelte";
  import PlayerList from "./components/PlayerList.svelte";
  import TurnIndicator from "./components/TurnIndicator.svelte";
  import DMToolbar from "./components/DMToolbar.svelte";

  const {
    state: sessionState,
    createSession,
    joinSession,
    reorderPlayers,
    removePlayer,
    advanceTurn,
    previousTurn,
    resetSession,
    addNpc,
    clearError,
  } = createSessionState();

  let currentPlayer = $derived(
    sessionState.players.find((p) => p.id === sessionState.turnState?.currentPlayerId) ?? null
  );
</script>

{#if sessionState.error}
  <div class="error-banner" role="alert">
    <span>{sessionState.error}</span>
    <button onclick={clearError}>&times;</button>
  </div>
{/if}

{#if !sessionState.sessionId}
  <Lobby {createSession} {joinSession} connectionStatus={sessionState.connectionStatus} />
{:else}
  <main class="session-view">
    <TurnIndicator
      {currentPlayer}
      round={sessionState.turnState?.round ?? 1}
      isDM={sessionState.isDM}
      myPlayerId={sessionState.playerId}
      connectionStatus={sessionState.connectionStatus}
    />

    <PlayerList
      players={sessionState.players}
      isDM={sessionState.isDM}
      myPlayerId={sessionState.playerId}
      {currentPlayer}
      onRemovePlayer={removePlayer}
      onReorderPlayers={reorderPlayers}
    />

    <DMToolbar
      isDM={sessionState.isDM}
      roomCode={sessionState.roomCode}
      dmToken={sessionState.dmToken}
      onAdvanceTurn={advanceTurn}
      onPreviousTurn={previousTurn}
      onResetSession={resetSession}
      onAddNpc={addNpc}
    />
  </main>
{/if}
