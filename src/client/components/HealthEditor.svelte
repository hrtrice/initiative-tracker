<script lang="ts">
  import { MAX_HP, MAX_HP_CHANGE } from "../lib/types";
  import type { HealthChange, HealthVisibility, PlayerView } from "../lib/types";
  import { HEALTH_VISIBILITY_OPTIONS } from "../lib/health";

  let {
    player,
    isDM = false,
    onchange,
    onvisibility,
    onclose,
  }: {
    player: PlayerView;
    isDM?: boolean;
    onchange: (change: HealthChange) => void;
    onvisibility?: (visibility: HealthVisibility) => void;
    onclose: () => void;
  } = $props();

  let amount = $state<number | null>(null);
  let tracked = $derived(player.health?.max !== undefined);

  /** Damage, heal or temp HP by the amount typed, then clear the box for the next hit. */
  function apply(kind: "damage" | "heal" | "temp") {
    if (amount === null || !Number.isInteger(amount)) return;
    // 0 is how temp HP are cleared; for damage and healing it means nothing.
    if (amount <= 0 && kind !== "temp") return;
    onchange({ kind, amount });
    amount = null;
  }

  /** Max HP saves on Enter or when the box loses focus. Blank stops tracking (after asking). */
  function commitMax(event: Event) {
    const raw = (event.currentTarget as HTMLInputElement).value.trim();
    if (raw === "") {
      if (tracked && confirm(`Stop tracking ${player.name}'s HP?`)) onchange({ kind: "max", amount: null });
      return;
    }
    const max = Number(raw);
    if (max !== player.health?.max) onchange({ kind: "max", amount: max });
  }
</script>

<div class="health-editor" role="group" aria-label="Health for {player.name}">
  {#if tracked}
    <div class="health-amount">
      <input
        type="number"
        inputmode="numeric"
        min="0"
        max={MAX_HP_CHANGE}
        placeholder="Amount"
        bind:value={amount}
        aria-label="Amount for {player.name}"
        onkeydown={(e) => e.key === "Enter" && apply("damage")}
      />
      <button type="button" class="btn-danger" onclick={() => apply("damage")}>Damage</button>
      <button type="button" class="btn-primary" onclick={() => apply("heal")}>Heal</button>
      <button type="button" class="btn-secondary" onclick={() => apply("temp")} title="Set temporary HP">
        Temp
      </button>
    </div>
  {/if}

  <label class="health-editor-row">
    <span>Max HP</span>
    <input
      type="number"
      inputmode="numeric"
      min="1"
      max={MAX_HP}
      placeholder={tracked ? "" : "e.g. 24"}
      value={player.health?.max ?? ""}
      onchange={commitMax}
      onkeydown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      aria-label="Max HP for {player.name}"
    />
  </label>

  {#if isDM && player.isNpc && onvisibility}
    <label class="health-editor-row">
      <span>Players see</span>
      <select
        value={player.healthVisibility}
        onchange={(e) => onvisibility((e.currentTarget as HTMLSelectElement).value as HealthVisibility)}
        aria-label="What players see of {player.name}'s health"
      >
        {#each HEALTH_VISIBILITY_OPTIONS as [value, text] (value)}
          <option {value}>{text}</option>
        {/each}
      </select>
    </label>
  {/if}

  <div class="field-editor-actions">
    <button type="button" class="btn-secondary" onclick={onclose}>Done</button>
  </div>
</div>
