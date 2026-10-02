<script lang="ts">
  import D20 from "./D20.svelte";
  import {
    rollD20,
    initiativeFromRoll,
    clampBonus,
    formatBonus,
    loadBonus,
    saveBonus,
    MIN_BONUS,
    MAX_BONUS,
  } from "../lib/dice";

  /** Rolls a d20 plus the player's initiative bonus and reports the total. */
  let {
    onroll,
    big = false,
  }: {
    onroll: (total: number) => void;
    /** The large centre-stage die (the initiative prompt) rather than the inline one (joining). */
    big?: boolean;
  } = $props();

  const TUMBLE_MS = 700;
  const FACE_MS = 60;

  let bonus = $state(loadBonus());
  let roll = $state<number | null>(null);
  let face = $state<number | null>(null);
  let rolling = $state(false);
  let shuffle: ReturnType<typeof setInterval> | undefined;
  let landing: ReturnType<typeof setTimeout> | undefined;

  // The prompt can close mid-tumble (say, the player types a number and claims it).
  $effect(() => () => {
    clearInterval(shuffle);
    clearTimeout(landing);
  });

  let total = $derived(roll === null ? null : initiativeFromRoll(roll, bonus));
  let crit = $derived<"success" | "fail" | null>(
    rolling || roll === null ? null : roll === 20 ? "success" : roll === 1 ? "fail" : null
  );

  function stepBonus(delta: number) {
    bonus = clampBonus(bonus + delta);
    saveBonus(bonus);
    // A changed bonus changes the total of a roll already on the table.
    if (roll !== null && !rolling) onroll(initiativeFromRoll(roll, bonus));
  }

  function throwDie() {
    if (rolling) return;
    const result = rollD20();
    const settle = () => {
      rolling = false;
      roll = result;
      face = result;
      onroll(initiativeFromRoll(result, bonus));
    };
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      settle();
      return;
    }
    rolling = true;
    roll = null;
    shuffle = setInterval(() => (face = rollD20()), FACE_MS);
    landing = setTimeout(() => {
      clearInterval(shuffle);
      settle();
    }, TUMBLE_MS);
  }
</script>

<div class="roller" class:big>
  <div class="roller-die" aria-hidden="true">
    <D20 {big} tumbling={rolling} {crit}>{face ?? "?"}</D20>
  </div>

  <p class="roller-result" aria-live="polite">
    {#if rolling}
      The die tumbles…
    {:else if roll !== null && total !== null}
      {#if crit === "success"}<span class="crit-note">Natural 20!</span>{/if}
      {#if crit === "fail"}<span class="crit-note fail">Natural 1…</span>{/if}
      You rolled <b>{roll}</b> {bonus < 0 ? "−" : "+"} <b>{Math.abs(bonus)}</b> = <b class="roller-total">{total}</b>
    {:else}
      Roll the die, or enter your own roll.
    {/if}
  </p>

  <div class="roller-controls">
    <div class="bonus-stepper" role="group" aria-label="Initiative bonus">
      <span class="bonus-label">Bonus</span>
      <button
        type="button"
        class="btn-secondary btn-icon"
        onclick={() => stepBonus(-1)}
        disabled={bonus <= MIN_BONUS}
        aria-label="Lower initiative bonus"
      >−</button>
      <output class="bonus-value" aria-label="Initiative bonus">{formatBonus(bonus)}</output>
      <button
        type="button"
        class="btn-secondary btn-icon"
        onclick={() => stepBonus(1)}
        disabled={bonus >= MAX_BONUS}
        aria-label="Raise initiative bonus"
      >+</button>
    </div>
    <!-- Gold until there's a roll; then the claim/join button is the main action. -->
    <button
      type="button"
      class="roll-button {big && roll === null ? 'btn-primary' : 'btn-secondary'}"
      onclick={throwDie}
      disabled={rolling}
    >
      {roll === null ? "Roll the d20" : "Roll Again"}
    </button>
  </div>
</div>
