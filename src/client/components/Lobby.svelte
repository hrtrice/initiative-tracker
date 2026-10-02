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
      recoverError = "Enter the table number and your full Master Key";
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
      roomCodeError = `The table number is ${ROOM_CODE_LENGTH} digits`;
      return;
    }
    joinSession(code, data.name, data.initiative);
  }
</script>

<div class="lobby">
  <header class="lobby-title">
    <h1>Initiative Tracker</h1>
    <p class="tagline">Gather the party. Roll for initiative.</p>
  </header>

  <div class="create-section">
    <button
      class="btn-primary"
      onclick={createSession}
      disabled={connectionStatus === "connecting"}
    >
      {connectionStatus === "connecting" ? "Lighting the torches…" : "Begin an Encounter"}
    </button>
  </div>

  <hr class="divider" />

  <div class="join-section card">
    <div class="form-group">
      <label for="roomCode">Table Number</label>
      <input
        id="roomCode"
        type="text"
        bind:value={roomCode}
        placeholder="4-digit table number"
        maxlength={ROOM_CODE_LENGTH}
        class="room-code-input"
        autocomplete="off"
      />
      {#if roomCodeError}
        <p class="field-error">{roomCodeError}</p>
      {/if}
    </div>

    <PlayerEntry onsubmit={handleJoin} />
  </div>

  <details class="recover-section card">
    <summary>Return as Dungeon Master</summary>
    <form onsubmit={handleRecover}>
      <div class="form-group">
        <label for="recoverCode">Table Number</label>
        <input id="recoverCode" type="text" inputmode="numeric" bind:value={recoverCode} maxlength={ROOM_CODE_LENGTH} autocomplete="off" />
      </div>
      <div class="form-group">
        <label for="recoverKey">Master Key</label>
        <input id="recoverKey" type="text" bind:value={recoverKey} autocomplete="off" spellcheck="false" />
      </div>
      {#if recoverError}
        <p class="field-error">{recoverError}</p>
      {/if}
      <div class="submit-row">
        <button type="submit" class="btn-secondary">Return as DM</button>
      </div>
    </form>
  </details>
</div>
