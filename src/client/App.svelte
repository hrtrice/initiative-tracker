<script lang="ts">
  import { createSessionState } from "./hooks/useSession.svelte";
  import Lobby from "./components/Lobby.svelte";
  import PlayerList from "./components/PlayerList.svelte";
  import TurnIndicator from "./components/TurnIndicator.svelte";
  import DMToolbar from "./components/DMToolbar.svelte";
  import InitiativePrompt from "./components/InitiativePrompt.svelte";
  import CustomFieldsManager from "./components/CustomFieldsManager.svelte";

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
    addField,
    updateField,
    removeField,
    setFieldValue,
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

  let myName = $derived(sessionState.players.find((p) => p.id === sessionState.playerId)?.name ?? "");

  function confirmLeave() {
    const message = sessionState.isDM
      ? "Leave the table? The game keeps running, and you can return with the table number and your Master Key."
      : "Leave the table? You'll be struck from the order of battle.";
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
    <div class="table-code">
      <span>Table <b>{sessionState.roomCode}</b></span>
      <span>{sessionState.isDM ? "Dungeon Master" : myName}</span>
    </div>

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

    <h2 class="section-title">Order of Battle</h2>

    <PlayerList
      players={sessionState.players}
      isDM={sessionState.isDM}
      myPlayerId={sessionState.playerId}
      {currentPlayer}
      onRemovePlayer={removePlayer}
      onReorderPlayers={reorderPlayers}
      onUpdateInitiative={updateInitiative}
      customFields={sessionState.customFields}
      onSetFieldValue={setFieldValue}
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

    {#if sessionState.isDM}
      <CustomFieldsManager
        fields={sessionState.customFields}
        onAdd={addField}
        onUpdate={updateField}
        onRemove={removeField}
      />
    {/if}

    <div class="leave-row">
      <button class="btn-ghost" onclick={confirmLeave}>Leave the Table</button>
    </div>
  </main>
{/if}
