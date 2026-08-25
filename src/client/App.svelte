<script lang="ts">
  import { onMount } from "svelte";
  import { createSessionState } from "./hooks/useSession.svelte";
  import Lobby from "./components/Lobby.svelte";
  import PlayerList from "./components/PlayerList.svelte";
  import TurnIndicator from "./components/TurnIndicator.svelte";
  import DMToolbar from "./components/DMToolbar.svelte";

  const {
    state: sessionState,
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
    addNpc,
    clearError,
    disconnect,
  } = createSessionState();

  let currentPlayer = $derived.by(() => {
    if (!sessionState.turnState) return null;
    return sessionState.players[sessionState.turnState.currentIndex] ?? null;
  });

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
  <Lobby {createSession} {joinSession} connectionStatus={sessionState.connectionStatus} />
{:else}
  <main class="session-view">
    <TurnIndicator
      currentPlayer={currentPlayer}
      round={sessionState.turnState?.round ?? 1}
      connectionStatus={sessionState.connectionStatus}
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
      onAddNpc={(name, initiative) => {
        if (sessionState.dmToken) addNpc(sessionState.dmToken, name, initiative);
      }}
    />
  </main>
{/if}
