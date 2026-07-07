<script lang="ts">
  let {
    isDM = false,
    roomCode,
    dmToken,
    onAdvanceTurn,
    onPreviousTurn,
    onResetSession,
  }: {
    isDM?: boolean;
    roomCode: string | null;
    dmToken: string | null;
    onAdvanceTurn?: () => void;
    onPreviousTurn?: () => void;
    onResetSession?: () => void;
  } = $props();

  let copyFeedback = $state("");

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
</script>

{#if isDM}
  <div class="dm-toolbar card">
    <div class="room-code" onclick={() => copyToClipboard(roomCode ?? "", "Room code")} title="Click to copy">
      {roomCode ?? "----"}
    </div>

    <div class="admin-key" onclick={() => copyToClipboard(dmToken ?? "", "Admin key")} title="Click to copy">
      {maskedKey}
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
