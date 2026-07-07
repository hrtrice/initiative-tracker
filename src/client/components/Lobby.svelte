<script lang="ts">
  import { ROOM_CODE_LENGTH } from "../lib/types";
  import type { ConnectionStatus } from "../lib/wsClient";
  import PlayerEntry from "./PlayerEntry.svelte";

  let {
    createSession,
    joinSession,
    connectionStatus,
  }: {
    createSession: () => void;
    joinSession: (roomCode: string, characterName: string, initiative: number) => void;
    connectionStatus: ConnectionStatus;
  } = $props();

  let mode = $state<"create" | "join">("create");
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

  <div class="mode-toggle">
    <button
      class="btn-secondary"
      class:active={mode === "create"}
      onclick={() => mode = "create"}
    >
      Create Session
    </button>
    <button
      class="btn-secondary"
      class:active={mode === "join"}
      onclick={() => mode = "join"}
    >
      Join Session
    </button>
  </div>

  {#if mode === "create"}
    <div class="create-section">
      <button
        class="btn-primary"
        onclick={createSession}
        disabled={connectionStatus === "connecting"}
      >
        {connectionStatus === "connecting" ? "Connecting..." : "Create New Session"}
      </button>
    </div>
  {:else}
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
  {/if}
</div>
