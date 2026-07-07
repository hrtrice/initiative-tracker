<script lang="ts">
  import { onMount } from "svelte";
  import { createSessionState } from "./hooks/useSession.svelte";
  import { createTurnDerived } from "./hooks/useTurnState.svelte";
  import Lobby from "./components/Lobby.svelte";
  import PlayerList from "./components/PlayerList.svelte";
  import TurnIndicator from "./components/TurnIndicator.svelte";
  import DMToolbar from "./components/DMToolbar.svelte";

  const {
    state,
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
    () => state.players,
    () => state.turnState,
  );

  let view = $state<"lobby" | "session">("lobby");

  $effect(() => {
    if (state.sessionId) {
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

{#if state.error}
  <div class="error-banner" role="alert">
    <span>{state.error}</span>
    <button onclick={clearError}>&times;</button>
  </div>
{/if}

{#if view === "lobby"}
  <Lobby {createSession} {joinSession} {connectionStatus} />
{:else}
  <main class="session-view">
    <TurnIndicator
      currentPlayer={currentPlayer}
      round={state.turnState?.round ?? 1}
      {connectionStatus}
    />

    <PlayerList
      players={state.players}
      isDM={state.isDM}
      {currentPlayer}
      onRemovePlayer={(playerId) => {
        if (state.dmToken) removePlayer(state.dmToken, playerId);
      }}
      onReorderPlayers={(orderedIds) => {
        if (state.dmToken) reorderPlayers(state.dmToken, orderedIds);
      }}
    />

    <DMToolbar
      isDM={state.isDM}
      roomCode={state.roomCode}
      dmToken={state.dmToken}
      onAdvanceTurn={() => {
        if (state.dmToken) advanceTurn(state.dmToken);
      }}
      onPreviousTurn={() => {
        if (state.dmToken) previousTurn(state.dmToken);
      }}
      onResetSession={() => {
        if (state.dmToken) resetSession(state.dmToken);
      }}
    />
  </main>
{/if}
