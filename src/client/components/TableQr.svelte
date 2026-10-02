<script lang="ts">
  import { qrSvg } from "../lib/qr";
  import { tableLink } from "../lib/tableLink";

  /** A button that opens a full-size QR code players scan to join this table. */
  let { roomCode }: { roomCode: string } = $props();

  let dialog = $state<HTMLDialogElement>();
  let copied = $state("");
  let link = $derived(tableLink(window.location.origin, roomCode));
  let qr = $derived(qrSvg(link));

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      copied = "Invite link copied!";
    } catch {
      copied = "Couldn't copy. Long-press the link instead.";
    }
    setTimeout(() => (copied = ""), 2000);
  }

  // Tapping the dimmed backdrop (the dialog element itself, outside the card) closes it.
  function closeOnBackdrop(event: MouseEvent) {
    if (event.target === dialog) dialog?.close();
  }
</script>

<button type="button" class="btn-secondary show-qr" onclick={() => dialog?.showModal()}>
  Show Table QR
</button>

<dialog bind:this={dialog} class="table-qr" aria-labelledby="table-qr-title" onclick={closeOnBackdrop}>
  <div class="table-qr-card">
    <h2 id="table-qr-title">Scan to Join the Party</h2>
    <!-- Dark on light: some phone scanners can't read light-on-dark codes. -->
    <svg
      class="qr-code"
      viewBox="0 0 {qr.size} {qr.size}"
      role="img"
      aria-label="QR code linking to Table {roomCode}"
      shape-rendering="crispEdges"
    >
      <rect width={qr.size} height={qr.size} class="qr-light" />
      <path d={qr.path} class="qr-dark" />
    </svg>
    <p class="table-qr-number">Table <b>{roomCode}</b></p>
    <a class="table-qr-link" href={link}>{link}</a>
    <div class="table-qr-actions">
      <button type="button" class="btn-secondary" onclick={copyLink}>Copy Invite Link</button>
      <button type="button" class="btn-primary" onclick={() => dialog?.close()}>Close</button>
    </div>
    <p class="table-qr-feedback" aria-live="polite">{copied}</p>
  </div>
</dialog>
