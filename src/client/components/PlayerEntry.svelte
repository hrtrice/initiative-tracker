<script lang="ts">
  import { MIN_NAME_LENGTH, MAX_NAME_LENGTH, MIN_INITIATIVE, MAX_INITIATIVE } from "../lib/types";
  import InitiativeRoller from "./InitiativeRoller.svelte";

  let {
    onsubmit,
  }: {
    onsubmit?: (data: { name: string; initiative: number }) => void;
  } = $props();

  let name = $state("");
  let initiativeStr = $state("0");
  let nameError = $state("");
  let initiativeError = $state("");

  function validate(): boolean {
    let valid = true;
    nameError = "";
    initiativeError = "";

    if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
      nameError = `Name must be ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} characters`;
      valid = false;
    }

    const initiative = parseInt(initiativeStr, 10);
    if (isNaN(initiative) || initiative < MIN_INITIATIVE || initiative > MAX_INITIATIVE) {
      initiativeError = `Initiative must be ${MIN_INITIATIVE} to ${MAX_INITIATIVE}`;
      valid = false;
    }

    return valid;
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!validate()) return;
    const initiative = parseInt(initiativeStr, 10);
    onsubmit?.({ name: name.trim(), initiative });
  }
</script>

<form onsubmit={handleSubmit}>
  <div class="form-group">
    <label for="name">Your Hero</label>
    <input
      id="name"
      type="text"
      bind:value={name}
      placeholder="e.g. Aragorn"
      maxlength={MAX_NAME_LENGTH}
      required
    />
    {#if nameError}
      <p class="field-error">{nameError}</p>
    {/if}
  </div>

  <div class="form-group">
    <label for="initiative">Initiative Roll</label>
    <input
      id="initiative"
      type="number"
      bind:value={initiativeStr}
      placeholder="0"
      min={MIN_INITIATIVE}
      max={MAX_INITIATIVE}
      required
    />
    {#if initiativeError}
      <p class="field-error">{initiativeError}</p>
    {/if}
    <InitiativeRoller onroll={(total) => (initiativeStr = String(total))} />
  </div>

  <div class="submit-row">
    <button type="submit" class="btn-primary">
      Join the Party
    </button>
  </div>
</form>
