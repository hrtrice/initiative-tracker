<script lang="ts">
  import type { Snippet } from "svelte";

  /** A d20 outline with the value inside it; the shape is decoration, the value is the content. */
  let {
    children,
    big = false,
    tumbling = false,
    crit = null,
  }: {
    children: Snippet;
    big?: boolean;
    tumbling?: boolean;
    /** Natural 20 or natural 1: the die lights up gold or red. */
    crit?: "success" | "fail" | null;
  } = $props();
</script>

<span
  class="d20"
  class:big
  class:tumbling
  class:crit-success={crit === "success"}
  class:crit-fail={crit === "fail"}
>
  <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <polygon
      class="face"
      points="50,4 91,27 91,73 50,96 9,73 9,27"
      stroke-width="5"
      stroke-linejoin="round"
    />
    <polygon class="facets" points="50,24 74,66 26,66" stroke-width="2.5" />
    <path
      class="facets"
      d="M50 4 L50 24 M91 27 L74 66 M9 27 L26 66 M91 73 L74 66 M9 73 L26 66 M50 96 L74 66 M50 96 L26 66"
      stroke-width="2.5"
    />
  </svg>
  <span class="d20-value">{@render children()}</span>
</span>
