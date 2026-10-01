<script lang="ts">
  /** Small horned monster face marking NPC rows. Inline SVG so it renders the same everywhere. */
  let { size = "1.1em" }: { size?: string } = $props();
</script>

<svg
  class="npc-icon"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  role="img"
  aria-label="NPC"
>
  <title>NPC</title>
  <g fill="currentColor">
    <path d="M3 2 L8.5 8.5 L6 10 Z" />
    <path d="M21 2 L15.5 8.5 L18 10 Z" />
    <circle cx="9" cy="13" r="1.4" />
    <circle cx="15" cy="13" r="1.4" />
  </g>
  <ellipse cx="12" cy="14.5" rx="7.5" ry="6.5" fill="none" stroke="currentColor" stroke-width="2" />
  <path
    d="M9 17.5 L10 19.5 L11 17.5 M13 17.5 L14 19.5 L15 17.5"
    fill="none"
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linejoin="round"
  />
</svg>
