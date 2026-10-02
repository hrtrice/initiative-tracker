<script lang="ts">
  import { MAX_NAME_LENGTH, MIN_INITIATIVE, MAX_INITIATIVE } from "../lib/types";
  import TableQr from "./TableQr.svelte";

  let {
    isDM = false,
    roomCode,
    dmToken,
    onAdvanceTurn,
    onPreviousTurn,
    onResetSession,
    onAddNpc,
  }: {
    isDM?: boolean;
    roomCode: string | null;
    dmToken: string | null;
    onAdvanceTurn?: () => void;
    onPreviousTurn?: () => void;
    onResetSession?: () => void;
    onAddNpc?: (name: string, initiative: number) => void;
  } = $props();

  let copyFeedback = $state("");
  let npcName = $state("");
  let npcInitiative = $state("");
  let npcFeedback = $state("");

  let maskedKey = $derived(dmToken ? dmToken.slice(0, 8) + "..." : "");

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      copyFeedback = `${label} copied!`;
      setTimeout(() => {
        copyFeedback = "";
      }, 1500);
    } catch {
      copyFeedback = "Failed to copy";
      setTimeout(() => {
        copyFeedback = "";
      }, 1500);
    }
  }

  function confirmNewCombat() {
    if (
      confirm("Begin a new encounter? Foes are cleared and heroes roll initiative again.")
    ) {
      onResetSession?.();
    }
  }

  function handleAddNpc() {
    const name = npcName.trim();
    const init = Number(npcInitiative);
    if (!name || isNaN(init)) {
      npcFeedback = "Name the foe and give its initiative";
      return;
    }
    onAddNpc?.(name, init);
    npcName = "";
    npcInitiative = "";
    npcFeedback = `${name} joins the fray!`;
    setTimeout(() => {
      npcFeedback = "";
    }, 1500);
  }
</script>

{#if isDM}
  <div class="dm-toolbar card">
    <button
      type="button"
      class="room-code"
      onclick={() => copyToClipboard(roomCode ?? "", "Table number")}
      title="Tap to copy"
    >
      {roomCode ?? "----"}
    </button>
    {#if roomCode}
      <TableQr {roomCode} />
    {/if}

    <button
      type="button"
      class="admin-key"
      onclick={() => copyToClipboard(dmToken ?? "", "Master Key")}
      title="Tap to copy"
    >
      Master Key: {maskedKey} (tap to copy)
    </button>
    <p class="admin-key-hint">Keep your Master Key to return as DM from another device.</p>

    <div class="add-npc-section">
      <h3>Summon a Foe</h3>
      <div class="npc-form">
        <input
          type="text"
          bind:value={npcName}
          placeholder="Foe's name"
          maxlength={MAX_NAME_LENGTH}
        />
        <input
          type="number"
          bind:value={npcInitiative}
          placeholder="Init"
          min={MIN_INITIATIVE}
          max={MAX_INITIATIVE}
        />
        <button class="btn-primary" onclick={handleAddNpc}>Summon</button>
      </div>
      {#if npcFeedback}
        <p class="npc-feedback">{npcFeedback}</p>
      {/if}
    </div>

    <div class="actions">
      <button class="btn-secondary" onclick={onPreviousTurn}>&#9664; Turn Back</button>
      <button class="btn-primary" onclick={onAdvanceTurn}>End Turn &#9654;</button>
      <button class="btn-danger" onclick={confirmNewCombat}>New Encounter</button>
    </div>
  </div>
{/if}

{#if copyFeedback}
  <div class="copy-feedback">{copyFeedback}</div>
{/if}
