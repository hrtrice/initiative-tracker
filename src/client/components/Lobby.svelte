<script lang="ts">
  import { ROOM_CODE_LENGTH } from "../lib/types";
  import type { ConnectionStatus } from "../lib/wsClient";
  import PlayerEntry from "./PlayerEntry.svelte";

  let {
    createSession,
    joinSession,
    recoverAsDm,
    connectionStatus,
  }: {
    createSession: () => void;
    joinSession: (roomCode: string, characterName: string, initiative: number) => void;
    recoverAsDm: (roomCode: string, dmToken: string) => void;
    connectionStatus: ConnectionStatus;
  } = $props();

  let recoverCode = $state("");
  let recoverKey = $state("");
  let recoverError = $state("");

  function handleRecover(event: SubmitEvent) {
    event.preventDefault();
    recoverError = "";
    if (recoverCode.trim().length !== ROOM_CODE_LENGTH || !recoverKey.trim()) {
      recoverError = "Enter the room code and the full Admin Key";
      return;
    }
    recoverAsDm(recoverCode, recoverKey);
  }

  let roomCode = $state("");
  let roomCodeError = $state("");

  function handleJoin(data: { name: string; initiative: number }) {
    roomCodeError = "";
    const code = roomCode.trim();
    if (code.length !== ROOM_CODE_LENGTH) {
      roomCodeError = `Room code must be ${ROOM_CODE_LENGTH} characters`;
      return;
    }
    joinSession(code, data.name, data.initiative);
  }
</script>

<div class="lobby">
  <h1>Initiative Tracker</h1>

  <div class="create-section">
    <button
      class="btn-primary"
      onclick={createSession}
      disabled={connectionStatus === "connecting"}
    >
      {connectionStatus === "connecting" ? "Connecting..." : "Create New Session"}
    </button>
  </div>

  <hr />

  <div class="join-section card">
    <div class="form-group">
      <label for="roomCode">Room Code</label>
      <input
        id="roomCode"
        type="text"
        bind:value={roomCode}
        placeholder="Enter 4-digit code"
        maxlength={ROOM_CODE_LENGTH}
        style="text-transform: uppercase; letter-spacing: 0.25em; font-family: var(--font-mono); text-align: center; font-size: 1.25rem;"
        autocomplete="off"
      />
      {#if roomCodeError}
        <p class="field-error">{roomCodeError}</p>
      {/if}
    </div>

    <PlayerEntry onsubmit={handleJoin} />
  </div>

  <details class="recover-section card">
    <summary>Rejoin as DM</summary>
    <form onsubmit={handleRecover}>
      <div class="form-group">
        <label for="recoverCode">Room Code</label>
        <input id="recoverCode" type="text" inputmode="numeric" bind:value={recoverCode} maxlength={ROOM_CODE_LENGTH} autocomplete="off" />
      </div>
      <div class="form-group">
        <label for="recoverKey">Admin Key</label>
        <input id="recoverKey" type="text" bind:value={recoverKey} autocomplete="off" spellcheck="false" />
      </div>
      {#if recoverError}
        <p class="field-error">{recoverError}</p>
      {/if}
      <div class="submit-row">
        <button type="submit" class="btn-secondary">Rejoin as DM</button>
      </div>
    </form>
  </details>
</div>
