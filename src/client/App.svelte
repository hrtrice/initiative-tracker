<script lang="ts">
  import { onMount } from "svelte";
  import { createSessionState } from "./hooks/useSession.svelte";
  import { createTurnDerived } from "./hooks/useTurnState.svelte";
  import Lobby from "./components/Lobby.svelte";
  import PlayerList from "./components/PlayerList.svelte";
  import TurnIndicator from "./components/TurnIndicator.svelte";
  import DMToolbar from "./components/DMToolbar.svelte";

  const {
    state: sessionState,
    connectionStatus,
    createSession,
    joinSession,
    reconnectSession,
    recoverSession,
    updateInitiative,
    reorderPlayers,
    removePlayer,
    advanceTurn,
    previousTurn,
    resetSession,
    clearError,
    disconnect,
  } = createSessionState();

  const { currentPlayer, isWrapping } = createTurnDerived(
    () => sessionState.players,
    () => sessionState.turnState,
  );

  let view = $state<"lobby" | "session">("lobby");

  $effect(() => {
    if (sessionState.sessionId) {
      view = "session";
    } else {
      view = "lobby";
    }
  });

  onMount(() => {
    const dmToken = sessionStorage.getItem("dmToken");
    const playerToken = sessionStorage.getItem("playerToken");
    const roomCode = sessionStorage.getItem("roomCode");

    if (dmToken && roomCode) {
      recoverSession(roomCode, dmToken);
    } else if (playerToken && roomCode) {
      reconnectSession(roomCode, playerToken);
    }
  });
</script>

{#if sessionState.error}
  <div class="error-banner" role="alert">
    <span>{sessionState.error}</span>
    <button onclick={clearError}>&times;</button>
  </div>
{/if}

{#if view === "lobby"}
  <Lobby {createSession} {joinSession} {connectionStatus} />
{:else}
  <main class="session-view">
    <TurnIndicator
      currentPlayer={currentPlayer}
      round={sessionState.turnState?.round ?? 1}
      {connectionStatus}
    />

    <PlayerList
      players={sessionState.players}
      isDM={sessionState.isDM}
      {currentPlayer}
      onRemovePlayer={(playerId) => {
        if (sessionState.dmToken) removePlayer(sessionState.dmToken, playerId);
      }}
      onReorderPlayers={(orderedIds) => {
        if (sessionState.dmToken) reorderPlayers(sessionState.dmToken, orderedIds);
      }}
    />

    <DMToolbar
      isDM={sessionState.isDM}
      roomCode={sessionState.roomCode}
      dmToken={sessionState.dmToken}
      onAdvanceTurn={() => {
        if (sessionState.dmToken) advanceTurn(sessionState.dmToken);
      }}
      onPreviousTurn={() => {
        if (sessionState.dmToken) previousTurn(sessionState.dmToken);
      }}
      onResetSession={() => {
        if (sessionState.dmToken) resetSession(sessionState.dmToken);
      }}
    />
  </main>
{/if}
