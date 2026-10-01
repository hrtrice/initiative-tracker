<script lang="ts">
  import { MAX_CUSTOM_FIELDS, MAX_FIELD_NAME_LENGTH, SUGGESTED_FIELDS } from "../lib/types";
  import type { CustomField, CustomFieldType } from "../lib/types";

  let {
    fields,
    onAdd,
    onUpdate,
    onRemove,
  }: {
    fields: CustomField[];
    onAdd: (name: string, type: CustomFieldType) => void;
    onUpdate: (fieldId: string, changes: { name?: string; type?: CustomFieldType }) => void;
    onRemove: (fieldId: string) => void;
  } = $props();

  let newName = $state("");
  let newType = $state<CustomFieldType>("number");

  let full = $derived(fields.length >= MAX_CUSTOM_FIELDS);
  let suggestions = $derived(
    SUGGESTED_FIELDS.filter(
      (s) => !fields.some((f) => f.name.toLowerCase() === s.name.toLowerCase())
    )
  );

  function add(event: SubmitEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onAdd(name, newType);
    newName = "";
  }

  function rename(field: CustomField, event: Event) {
    const name = (event.currentTarget as HTMLInputElement).value.trim();
    if (name && name !== field.name) onUpdate(field.id, { name });
  }

  function retype(field: CustomField, event: Event) {
    const type = (event.currentTarget as HTMLSelectElement).value as CustomFieldType;
    if (type === field.type) return;
    const warning =
      type === "number"
        ? `Change "${field.name}" to Number? Values that aren't whole numbers will be cleared.`
        : null;
    if (warning && !confirm(warning)) {
      (event.currentTarget as HTMLSelectElement).value = field.type;
      return;
    }
    onUpdate(field.id, { type });
  }

  function remove(field: CustomField) {
    if (confirm(`Delete "${field.name}"? Everyone's ${field.name} values are removed too.`)) {
      onRemove(field.id);
    }
  }
</script>

<section class="fields-manager card" aria-label="Custom fields">
  <h3>Custom fields <span class="fields-count">{fields.length}/{MAX_CUSTOM_FIELDS}</span></h3>

  {#if fields.length > 0}
    <ul class="fields-list">
      {#each fields as field (field.id)}
        <li class="fields-list-row">
          <input
            type="text"
            value={field.name}
            maxlength={MAX_FIELD_NAME_LENGTH}
            onchange={(e) => rename(field, e)}
            aria-label="Name of field {field.name}"
          />
          <select
            value={field.type}
            onchange={(e) => retype(field, e)}
            aria-label="Type of field {field.name}"
          >
            <option value="number">Number</option>
            <option value="text">Text</option>
          </select>
          <button
            type="button"
            class="btn-icon btn-danger"
            onclick={() => remove(field)}
            aria-label="Delete field {field.name}"
          >&#10005;</button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if !full}
    {#if suggestions.length > 0}
      <div class="field-suggestions">
        {#each suggestions as s (s.name)}
          <button type="button" class="btn-ghost chip" onclick={() => onAdd(s.name, s.type)}>
            + {s.name}
          </button>
        {/each}
      </div>
    {/if}
    <form class="fields-add" onsubmit={add}>
      <input
        type="text"
        bind:value={newName}
        placeholder="New field name"
        maxlength={MAX_FIELD_NAME_LENGTH}
        aria-label="New field name"
      />
      <select bind:value={newType} aria-label="New field type">
        <option value="number">Number</option>
        <option value="text">Text</option>
      </select>
      <button type="submit" class="btn-primary">Add field</button>
    </form>
  {:else}
    <p class="fields-hint">Field limit reached. Delete one to add another.</p>
  {/if}
</section>
