<script lang="ts">
  import {
    MAX_FIELD_TEXT_LENGTH,
    MIN_FIELD_NUMBER,
    MAX_FIELD_NUMBER,
  } from "../lib/types";
  import type { CustomField, FieldValue, PlayerView } from "../lib/types";

  let {
    player,
    fields,
    onchange,
    onclose,
  }: {
    player: PlayerView;
    fields: CustomField[];
    onchange: (fieldId: string, value: FieldValue | null) => void;
    onclose: () => void;
  } = $props();

  /** Saves when the input commits (blur or Enter). Blank clears the value. */
  function commit(field: CustomField, event: Event) {
    const raw = (event.currentTarget as HTMLInputElement).value.trim();
    const value: FieldValue | null = raw === "" ? null : field.type === "number" ? Number(raw) : raw;
    if (value === (player.fields[field.id] ?? null)) return;
    onchange(field.id, value);
  }
</script>

<div class="field-editor" role="group" aria-label="Custom fields for {player.name}">
  {#each fields as field (field.id)}
    <label class="field-editor-row">
      <span>{field.name}</span>
      {#if field.type === "number"}
        <input
          type="number"
          inputmode="numeric"
          min={MIN_FIELD_NUMBER}
          max={MAX_FIELD_NUMBER}
          value={player.fields[field.id] ?? ""}
          onchange={(e) => commit(field, e)}
          aria-label="{field.name} for {player.name}"
        />
      {:else}
        <input
          type="text"
          maxlength={MAX_FIELD_TEXT_LENGTH}
          value={player.fields[field.id] ?? ""}
          onchange={(e) => commit(field, e)}
          aria-label="{field.name} for {player.name}"
        />
      {/if}
    </label>
  {/each}
  <div class="field-editor-actions">
    <button type="button" class="btn-secondary" onclick={onclose}>Done</button>
  </div>
</div>
