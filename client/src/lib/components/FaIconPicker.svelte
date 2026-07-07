<script lang="ts">
  import { FA_ICONS } from '$lib/faIcons';

  let { value, onselect, onclose }: {
    value: string | null;
    onselect: (cls: string) => void;
    onclose: () => void;
  } = $props();

  let search = $state('');

  let filtered = $derived(
    search.trim()
      ? FA_ICONS.filter(ic =>
          ic.label.toLowerCase().includes(search.toLowerCase()) ||
          ic.cls.toLowerCase().includes(search.toLowerCase())
        )
      : FA_ICONS
  );

  function select(cls: string) {
    onselect(cls);
    onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="picker-overlay" onclick={onclose}>
  <div class="picker-modal" onclick={(e) => e.stopPropagation()}>
    <div class="picker-header">
      <span class="picker-title"><i class="fa-solid fa-icons"></i> Choose an icon</span>
      <button class="picker-close" onclick={onclose} aria-label="Close">×</button>
    </div>
    <div class="picker-search">
      <!-- svelte-ignore a11y_autofocus -->
      <input type="text" bind:value={search} placeholder="Search icons…" autofocus />
    </div>
    <div class="picker-grid">
      {#each filtered as icon (icon.cls)}
        <button
          class="picker-icon"
          class:selected={icon.cls === value}
          onclick={() => select(icon.cls)}
          title={icon.label}
        >
          <i class={icon.cls}></i>
          <span>{icon.label}</span>
        </button>
      {/each}
      {#if filtered.length === 0}
        <p class="picker-empty">No icons found</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .picker-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .picker-modal {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    width: 100%;
    max-width: 540px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .picker-title {
    font-weight: 600;
    font-size: 15px;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .picker-close {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: var(--text-muted);
    cursor: pointer;
    line-height: 1;
    padding: 0.1rem 0.35rem;
    border-radius: var(--radius);
  }
  .picker-close:hover { color: var(--text); }

  .picker-search {
    padding: 0.65rem 1rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .picker-search input { width: 100%; }

  .picker-grid {
    overflow-y: auto;
    padding: 0.6rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
    gap: 0.25rem;
  }

  .picker-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 0.25rem;
    padding: 0.55rem 0.2rem 0.4rem;
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius);
    cursor: pointer;
    color: var(--text);
    transition: background 0.1s, border-color 0.1s, color 0.1s;
  }
  .picker-icon i {
    font-size: 1.15rem;
    line-height: 1;
  }
  .picker-icon span {
    font-size: 10px;
    color: var(--text-muted);
    text-align: center;
    word-break: break-word;
    line-height: 1.2;
    max-width: 100%;
  }
  .picker-icon:hover {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border-color: var(--border);
  }
  .picker-icon.selected {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    border-color: var(--accent);
    color: var(--accent);
  }
  .picker-icon.selected span { color: var(--accent); }

  .picker-empty {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
    padding: 2rem;
  }
</style>
