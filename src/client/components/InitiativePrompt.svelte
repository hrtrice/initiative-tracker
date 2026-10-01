<script lang="ts">
  import { MIN_INITIATIVE, MAX_INITIATIVE } from "../lib/types";

  let { onsubmit }: { onsubmit: (initiative: number) => void } = $props();

  let value = $state<number | null>(null);
  let error = $state("");

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (value === null || !Number.isInteger(value) || value < MIN_INITIATIVE || value > MAX_INITIATIVE) {
      error = `Initiative must be ${MIN_INITIATIVE} to ${MAX_INITIATIVE}`;
      return;
    }
    error = "";
    onsubmit(value);
  }
</script>

<div class="initiative-prompt card" role="region" aria-label="Enter your initiative">
  <h3>New combat! Roll initiative</h3>
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
    <button type="submit" class="btn-primary">Submit</button>
  </form>
  {#if error}
    <p class="field-error">{error}</p>
  {/if}
</div>
