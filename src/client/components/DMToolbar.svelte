<script lang="ts">
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
    <div class="room-code" onclick={() => copyToClipboard(roomCode ?? "", "Room code")} title="Click to copy">
      {roomCode ?? "----"}
    </div>

    <div class="admin-key" onclick={() => copyToClipboard(dmToken ?? "", "Admin key")} title="Click to copy">
      {maskedKey}
    </div>

    <div class="add-npc-section">
      <h3>Add NPC</h3>
      <div class="npc-form">
        <input
          type="text"
          bind:value={npcName}
          placeholder="NPC name"
          maxlength={20}
        />
        <input
          type="number"
          bind:value={npcInitiative}
          placeholder="Init"
          min={-10}
          max={30}
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
      <button class="btn-danger" onclick={onResetSession}>Reset</button>
    </div>
  </div>
{/if}

{#if copyFeedback}
  <div class="copy-feedback">{copyFeedback}</div>
{/if}
