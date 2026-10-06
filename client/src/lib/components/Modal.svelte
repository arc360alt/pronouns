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
  <div slot="content">
    {#if open}{@render children()}{/if}
  </div>
</md-dialog>
