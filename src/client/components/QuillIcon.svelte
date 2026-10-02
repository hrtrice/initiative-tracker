<script lang="ts">
  /** A quill, for "edit". Decorative: the button around it carries the label. */
  let { size = "1.25rem" }: { size?: string } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  aria-hidden="true"
  focusable="false"
>
  <path d="M20 3c-6 1-11 6-13 13l-2 5" />
  <path d="M20 3c0 6-4 11-11 12" />
  <path d="M9 15l-3 1" />
</svg>
