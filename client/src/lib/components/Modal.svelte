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

<!-- Material 3 dialog: md-dialog supplies the scrim, motion and focus trapping -->
<md-dialog {open} onclose={() => { if (open) onClose(); }}>
  <div slot="headline" class="modal-dialog-headline">
    <span>{title}</span>
    <md-icon-button onclick={onClose} aria-label="Close"><i class="fa-solid fa-xmark"></i></md-icon-button>
  </div>
  <!-- Initial focus target, so the close button doesn't open with a focus ring -->
  <!-- svelte-ignore a11y_autofocus -->
  <div slot="content" tabindex="-1" autofocus>
    {#if open}{@render children()}{/if}
  </div>
</md-dialog>
