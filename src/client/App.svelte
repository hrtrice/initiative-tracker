<script lang="ts">
  import { createSessionState } from "./hooks/useSession.svelte";
  import Lobby from "./components/Lobby.svelte";
  import PlayerList from "./components/PlayerList.svelte";
  import TurnIndicator from "./components/TurnIndicator.svelte";
  import DMToolbar from "./components/DMToolbar.svelte";
  import InitiativePrompt from "./components/InitiativePrompt.svelte";

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
    updateInitiative,
    recoverAsDm,
    submitInitiative,
    leaveSession,
    clearError,
  } = createSessionState();

  let currentPlayer = $derived(
    sessionState.players.find((p) => p.id === sessionState.turnState?.currentPlayerId) ?? null
  );

  let needsInitiative = $derived(
    !sessionState.isDM &&
      sessionState.players.some((p) => p.id === sessionState.playerId && p.initiative === null)
  );

  function confirmLeave() {
    const message = sessionState.isDM
      ? "Leave this session? It keeps running, and you can rejoin with the room code and Admin Key."
      : "Leave this session? You'll be removed from the initiative order.";
    if (confirm(message)) leaveSession();
  }
</script>

{#if sessionState.error}
  <div class="error-banner" role="alert">
    <span>{sessionState.error}</span>
    <button onclick={clearError}>&times;</button>
  </div>
{/if}

{#if !sessionState.sessionId}
  <Lobby {createSession} {joinSession} {recoverAsDm} connectionStatus={sessionState.connectionStatus} />
{:else}
  <main class="session-view">
    <TurnIndicator
      {currentPlayer}
      round={sessionState.turnState?.round ?? 1}
      isDM={sessionState.isDM}
      myPlayerId={sessionState.playerId}
      connectionStatus={sessionState.connectionStatus}
    />

    {#if needsInitiative}
      <InitiativePrompt onsubmit={submitInitiative} />
    {/if}

    <PlayerList
      players={sessionState.players}
      isDM={sessionState.isDM}
      myPlayerId={sessionState.playerId}
      {currentPlayer}
      onRemovePlayer={removePlayer}
      onReorderPlayers={reorderPlayers}
      onUpdateInitiative={updateInitiative}
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

    <div class="leave-row">
      <button class="btn-ghost" onclick={confirmLeave}>Leave session</button>
    </div>
  </main>
{/if}
