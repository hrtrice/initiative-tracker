<script lang="ts">
  import { MIN_INITIATIVE, MAX_INITIATIVE } from "../lib/types";
  import InitiativeRoller from "./InitiativeRoller.svelte";

  let { onsubmit }: { onsubmit: (initiative: number) => void } = $props();

  let value = $state<number | null>(null);
  let error = $state("");
  let valid = $derived(
    value !== null && Number.isInteger(value) && value >= MIN_INITIATIVE && value <= MAX_INITIATIVE
  );

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!valid || value === null) {
      error = `Initiative must be ${MIN_INITIATIVE} to ${MAX_INITIATIVE}`;
      return;
    }
    error = "";
    onsubmit(value);
  }
</script>

<div class="initiative-prompt card" role="region" aria-label="Enter your initiative">
  <h3>Roll for Initiative!</h3>
  <InitiativeRoller big onroll={(total) => (value = total)} />
  <form onsubmit={handleSubmit}>
    <div class="form-group">
      <label for="my-initiative">Your initiative</label>
      <input
        id="my-initiative"
        type="number"
        inputmode="numeric"
        bind:value
        min={MIN_INITIATIVE}
        max={MAX_INITIATIVE}
      />
    </div>
    <button type="submit" class={valid ? "btn-primary" : "btn-secondary"}>
      {valid ? `Claim ${value}` : "Take My Place"}
    </button>
  </form>
  {#if error}
    <p class="field-error">{error}</p>
  {/if}
</div>
