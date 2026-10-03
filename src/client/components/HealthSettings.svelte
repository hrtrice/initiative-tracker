<script lang="ts">
  import type { HealthSettings, HealthVisibility } from "../lib/types";
  import { HEALTH_VISIBILITY_OPTIONS } from "../lib/health";

  /** The DM's table-wide health switches. */
  let {
    settings,
    onchange,
  }: {
    settings: HealthSettings;
    onchange: (changes: Partial<HealthSettings>) => void;
  } = $props();
</script>

<section class="health-settings card" aria-label="Health settings">
  <h3>Health</h3>
  <label class="toggle-row">
    <input
      type="checkbox"
      checked={settings.enabled}
      onchange={(e) => onchange({ enabled: (e.currentTarget as HTMLInputElement).checked })}
    />
    <span>Show health to players</span>
  </label>
  <p class="fields-hint">
    {settings.enabled
      ? "Heroes' HP is shown to everyone. Each foe shows players only what you choose."
      : "Players see no health, not even their own. You still see everything."}
  </p>
  <label class="health-editor-row">
    <span>New foes show players</span>
    <select
      value={settings.npcDefault}
      onchange={(e) => onchange({ npcDefault: (e.currentTarget as HTMLSelectElement).value as HealthVisibility })}
    >
      {#each HEALTH_VISIBILITY_OPTIONS as [value, text] (value)}
        <option {value}>{text}</option>
      {/each}
    </select>
  </label>
</section>
