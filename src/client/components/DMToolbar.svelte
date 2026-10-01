<script lang="ts">
  import { MAX_NAME_LENGTH, MIN_INITIATIVE, MAX_INITIATIVE } from "../lib/types";

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
      confirm("Start a new combat? NPCs are removed and players re-enter their initiative.")
    ) {
      onResetSession?.();
    }
  }

  function handleAddNpc() {
    const name = npcName.trim();
    const init = Number(npcInitiative);
    if (!name || isNaN(init)) {
      npcFeedback = "Enter a name and initiative";
      return;
    }
    onAddNpc?.(name, init);
    npcName = "";
    npcInitiative = "";
    npcFeedback = "NPC added!";
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
      onclick={() => copyToClipboard(roomCode ?? "", "Room code")}
      title="Tap to copy"
    >
      {roomCode ?? "----"}
    </button>

    <button
      type="button"
      class="admin-key"
      onclick={() => copyToClipboard(dmToken ?? "", "Admin Key")}
      title="Tap to copy"
    >
      Admin Key: {maskedKey} (tap to copy)
    </button>
    <p class="admin-key-hint">Keep this to rejoin as DM from another device.</p>

    <div class="add-npc-section">
      <h3>Add NPC</h3>
      <div class="npc-form">
        <input
          type="text"
          bind:value={npcName}
          placeholder="NPC name"
          maxlength={MAX_NAME_LENGTH}
        />
        <input
          type="number"
          bind:value={npcInitiative}
          placeholder="Init"
          min={MIN_INITIATIVE}
          max={MAX_INITIATIVE}
        />
        <button class="btn-primary" onclick={handleAddNpc}>Add</button>
      </div>
      {#if npcFeedback}
        <p class="npc-feedback">{npcFeedback}</p>
      {/if}
    </div>

    <div class="actions">
      <button class="btn-secondary" onclick={onPreviousTurn}>&#9664; Previous</button>
      <button class="btn-primary" onclick={onAdvanceTurn}>Next &#9654;</button>
      <button class="btn-danger" onclick={confirmNewCombat}>New combat</button>
    </div>
  </div>
{/if}

{#if copyFeedback}
  <div class="copy-feedback">{copyFeedback}</div>
{/if}
