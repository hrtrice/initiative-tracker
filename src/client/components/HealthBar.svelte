<script lang="ts">
  import type { HealthView } from "../lib/types";

  /** A character's health as the viewer may see it: a bar, numbers, or both. */
  let { health }: { health: HealthView } = $props();

  const STATE_LABEL = { healthy: "", bloodied: "Bloodied", down: "Down" } as const;
  let hasNumbers = $derived(health.current !== undefined && health.max !== undefined);
  let label = $derived(STATE_LABEL[health.state]);
  let summary = $derived(
    [
      hasNumbers ? `${health.current} of ${health.max} HP` : `about ${Math.round(health.ratio * 100)}% health`,
      health.temp ? `plus ${health.temp} temporary` : "",
      label,
    ]
      .filter(Boolean)
      .join(", ")
  );
</script>

<div
  class="health"
  class:bloodied={health.state === "bloodied"}
  class:down={health.state === "down"}
  role="img"
  aria-label="Health: {summary}"
>
  {#if health.showBar}
    <span class="health-bar" aria-hidden="true">
      <span class="health-fill" style="width: {health.ratio * 100}%"></span>
    </span>
  {/if}
  <span class="health-text" aria-hidden="true">
    {#if hasNumbers}
      <span><b>{health.current}</b>/{health.max}</span>
      {#if health.temp}<span class="health-temp">+{health.temp}</span>{/if}
    {/if}
    {#if health.showBar && label}<span class="health-state">{label}</span>{/if}
  </span>
</div>
