<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    title: string;
    onClose: () => void;
    children: Snippet;
  }

  let { open, title, onClose, children }: Props = $props();
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" role="dialog" aria-modal="true" onclick={onClose}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-box" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>{title}</h3>
        <button class="modal-close" onclick={onClose}>×</button>
      </div>
      <div class="modal-body">
        {@render children()}
      </div>
    </div>
  </div>
{/if}
