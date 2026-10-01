<script lang="ts">
  import { MIN_INITIATIVE, MAX_INITIATIVE } from "../lib/types";
  import type { CustomField, FieldValue, PlayerView } from "../lib/types";
  import FieldEditor from "./FieldEditor.svelte";
  import NpcIcon from "./NpcIcon.svelte";

  let {
    players = [],
    isDM = false,
    myPlayerId = null,
    currentPlayer,
    onRemovePlayer,
    onReorderPlayers,
    onUpdateInitiative,
    customFields = [],
    onSetFieldValue,
  }: {
    players: PlayerView[];
    isDM?: boolean;
    myPlayerId?: string | null;
    currentPlayer: PlayerView | null;
    onRemovePlayer?: (playerId: string) => void;
    onReorderPlayers?: (orderedPlayerIds: string[]) => void;
    onUpdateInitiative?: (playerId: string, initiative: number) => void;
    customFields?: CustomField[];
    onSetFieldValue?: (playerId: string, fieldId: string, value: FieldValue | null) => void;
  } = $props();

  /** The row whose custom field editor is open. DMs can edit any row; players only their own. */
  let editingFieldsOf = $state<string | null>(null);
  const canEditFields = (player: PlayerView) =>
    customFields.length > 0 && (isDM || player.id === myPlayerId);
  /** Every field shows on every row, empty ones as "—". NPC values are secret, so
   *  players see no fields at all on NPC rows rather than misleading blanks. */
  const showsFields = (player: PlayerView) =>
    customFields.length > 0 && (isDM || !player.isNpc);

  /** The row whose initiative the DM is editing, and the draft value. */
  let editingId = $state<string | null>(null);
  let draft = $state<number | null>(null);

  function startEdit(player: PlayerView) {
    editingId = player.id;
    draft = player.initiative;
  }

  function commitEdit(player: PlayerView) {
    if (editingId !== player.id) return;
    editingId = null;
    if (draft === null || !Number.isInteger(draft) || draft === player.initiative) return;
    onUpdateInitiative?.(player.id, draft);
  }

  function onEditKey(event: KeyboardEvent, player: PlayerView) {
    if (event.key === "Enter") commitEdit(player);
    if (event.key === "Escape") editingId = null;
  }

  function focusOnMount(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  // The server sends players in turn order; swap neighbours and send the full new order.
  function swap(a: number, b: number) {
    const ids = players.map((p) => p.id);
    [ids[a], ids[b]] = [ids[b]!, ids[a]!];
    onReorderPlayers?.(ids);
  }
</script>

{#if players.length === 0}
  <p class="empty-state">
    {isDM ? "No one yet. Share the room code, or add NPCs below." : "Waiting for players to join..."}
  </p>
{:else}
  <ul class="player-list">
    {#each players as player, i (player.id)}
      <li class="player-row" class:current-turn={currentPlayer?.id === player.id}>
        <span class="initiative">
          {#if isDM && editingId === player.id}
            <input
              class="initiative-edit"
              type="number"
              inputmode="numeric"
              min={MIN_INITIATIVE}
              max={MAX_INITIATIVE}
              bind:value={draft}
              onblur={() => commitEdit(player)}
              onkeydown={(e) => onEditKey(e, player)}
              aria-label="Initiative for {player.name}"
              use:focusOnMount
            />
          {:else if isDM}
            <button
              type="button"
              class="initiative-btn initiative"
              onclick={() => startEdit(player)}
              aria-label="Edit initiative for {player.name}"
            >{player.initiative ?? "—"}</button>
          {:else}
            {player.initiative ?? "—"}
          {/if}
        </span>
        <span class="name">
          {player.name}
          {#if player.isNpc}
            <NpcIcon />
          {/if}
          {#if player.id === myPlayerId}
            <span class="badge">You</span>
          {/if}
        </span>
        {#if canEditFields(player)}
          <button
            class="btn-icon btn-ghost"
            onclick={() => (editingFieldsOf = editingFieldsOf === player.id ? null : player.id)}
            aria-expanded={editingFieldsOf === player.id}
            aria-label="Edit fields for {player.name}"
          >&#9998;</button>
        {/if}
        {#if isDM}
          <div class="controls">
            <button
              class="btn-icon btn-ghost"
              onclick={() => swap(i - 1, i)}
              disabled={i === 0}
              aria-label="Move {player.name} up"
            >&#9650;</button>
            <button
              class="btn-icon btn-ghost"
              onclick={() => swap(i, i + 1)}
              disabled={i === players.length - 1}
              aria-label="Move {player.name} down"
            >&#9660;</button>
            <button
              class="btn-icon btn-danger"
              onclick={() => onRemovePlayer?.(player.id)}
              aria-label="Remove {player.name}"
            >&#10005;</button>
          </div>
        {/if}
        {#if showsFields(player)}
          <span class="field-chips">
            {#each customFields as field (field.id)}
              <span class="field-chip" class:empty={!(field.id in player.fields)}>
                {field.name} {player.fields[field.id] ?? "—"}
              </span>
            {/each}
          </span>
        {/if}
      </li>
      {#if editingFieldsOf === player.id && canEditFields(player)}
        <li class="field-editor-item">
          <FieldEditor
            {player}
            fields={customFields}
            onchange={(fieldId, value) => onSetFieldValue?.(player.id, fieldId, value)}
            onclose={() => (editingFieldsOf = null)}
          />
        </li>
      {/if}
    {/each}
  </ul>
{/if}
