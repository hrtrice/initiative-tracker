<script lang="ts">
  /** A heart, for "health". Decorative: the button around it carries the label. */
  let { size = "1.2rem" }: { size?: string } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
</svg>
