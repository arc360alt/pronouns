<script lang="ts">
  import { tick } from 'svelte';
  import { renderMarkdown } from '$lib/markdown';

  let {
    value = $bindable(''),
    rows = 6,
    placeholder = '',
    id = '',
  }: { value?: string; rows?: number; placeholder?: string; id?: string } = $props();

  let textarea: HTMLTextAreaElement | undefined = $state();
  let preview = $state(false);
  let selStart = $state(0);
  let selEnd = $state(0);

  let hasSel = $derived(selEnd > selStart);

  function syncSel() {
    if (textarea) { selStart = textarea.selectionStart; selEnd = textarea.selectionEnd; }
  }

  // Prevent toolbar buttons from stealing focus (keeps selection alive)
  function keepFocus(e: MouseEvent) {
    e.preventDefault();
    syncSel();
  }

  async function wrap(pre: string, suf: string, ph: string) {
    if (!textarea) return;
    const s = textarea.selectionStart, e = textarea.selectionEnd;
    const sel = value.slice(s, e);
    const text = sel || ph;
    value = value.slice(0, s) + pre + text + suf + value.slice(e);
    await tick();
    if (!sel) {
      textarea.selectionStart = s + pre.length;
      textarea.selectionEnd   = s + pre.length + text.length;
    } else {
      textarea.selectionStart = s;
      textarea.selectionEnd   = s + pre.length + text.length + suf.length;
    }
    textarea.focus();
    syncSel();
  }

  async function prependLine(marker: string) {
    if (!textarea) return;
    const s = textarea.selectionStart;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const afterStart = value.slice(lineStart);
    const rel = afterStart.indexOf('\n');
    const lineEnd = rel === -1 ? value.length : lineStart + rel;
    const line = value.slice(lineStart, lineEnd);

    if (line.startsWith(marker)) {
      value = value.slice(0, lineStart) + line.slice(marker.length) + value.slice(lineEnd);
    } else {
      value = value.slice(0, lineStart) + marker + value.slice(lineStart);
    }
    await tick();
    textarea.focus();
    syncSel();
  }

  async function insertLink() {
    if (!textarea) return;
    const s = textarea.selectionStart, e = textarea.selectionEnd;
    const sel = value.slice(s, e);
    if (sel) {
      value = value.slice(0, s) + `[${sel}](url)` + value.slice(e);
      await tick();
      textarea.selectionStart = s + sel.length + 3;
      textarea.selectionEnd   = s + sel.length + 6;
    } else {
      value = value.slice(0, s) + '[link text](url)' + value.slice(e);
      await tick();
      textarea.selectionStart = s + 1;
      textarea.selectionEnd   = s + 10;
    }
    textarea.focus();
    syncSel();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.key === 'b') { e.preventDefault(); wrap('**', '**', 'bold text'); }
    else if (e.key === 'i') { e.preventDefault(); wrap('*', '*', 'italic text'); }
    else if (e.key === 'k') { e.preventDefault(); insertLink(); }
  }
</script>

<div class="md-editor">
  <!-- Toolbar -->
  <div class="md-toolbar">
    <!-- Inline formatting (highlight when selection active) -->
    <button type="button" class="md-btn" class:sel={hasSel} title="Bold (Ctrl+B)"
      onmousedown={keepFocus} onclick={() => wrap('**', '**', 'bold text')}>
      <b>B</b>
    </button>
    <button type="button" class="md-btn" class:sel={hasSel} title="Italic (Ctrl+I)"
      onmousedown={keepFocus} onclick={() => wrap('*', '*', 'italic text')}>
      <em>I</em>
    </button>
    <button type="button" class="md-btn" class:sel={hasSel} title="Strikethrough"
      onmousedown={keepFocus} onclick={() => wrap('~~', '~~', 'strikethrough')}>
      <s>S</s>
    </button>
    <button type="button" class="md-btn" class:sel={hasSel} title="Inline code"
      onmousedown={keepFocus} onclick={() => wrap('`', '`', 'code')}>
      <i class="fa-solid fa-code" style="font-size:11px"></i>
    </button>
    <button type="button" class="md-btn" class:sel={hasSel} title="Link (Ctrl+K)"
      onmousedown={keepFocus} onclick={insertLink}>
      <i class="fa-solid fa-link" style="font-size:11px"></i>
    </button>

    <div class="md-sep"></div>

    <!-- Block formatting -->
    <button type="button" class="md-btn" title="Heading 1"
      onmousedown={keepFocus} onclick={() => prependLine('# ')}>H1</button>
    <button type="button" class="md-btn" title="Heading 2"
      onmousedown={keepFocus} onclick={() => prependLine('## ')}>H2</button>
    <button type="button" class="md-btn" title="Heading 3"
      onmousedown={keepFocus} onclick={() => prependLine('### ')}>H3</button>

    <div class="md-sep"></div>

    <button type="button" class="md-btn" title="Bullet list"
      onmousedown={keepFocus} onclick={() => prependLine('- ')}>
      <i class="fa-solid fa-list-ul" style="font-size:11px"></i>
    </button>
    <button type="button" class="md-btn" title="Numbered list"
      onmousedown={keepFocus} onclick={() => prependLine('1. ')}>
      <i class="fa-solid fa-list-ol" style="font-size:11px"></i>
    </button>
    <button type="button" class="md-btn" title="Blockquote"
      onmousedown={keepFocus} onclick={() => prependLine('> ')}>
      <i class="fa-solid fa-quote-left" style="font-size:11px"></i>
    </button>

    <div class="md-spacer"></div>

    {#if hasSel}
      <span class="md-sel-hint">{selEnd - selStart} selected</span>
    {/if}

    <button type="button" class="md-btn md-preview-btn" class:active={preview}
      onclick={() => preview = !preview}>
      <i class="fa-solid fa-{preview ? 'pen' : 'eye'}" style="font-size:11px"></i>
      {preview ? 'Edit' : 'Preview'}
    </button>
  </div>

  <!-- Editor / Preview -->
  {#if preview}
    <div class="bio-content md-preview-pane">
      {#if value.trim()}
        {@html renderMarkdown(value)}
      {:else}
        <span class="md-empty">Nothing to preview yet…</span>
      {/if}
    </div>
  {:else}
    <textarea
      bind:this={textarea}
      bind:value
      {rows}
      {placeholder}
      {id}
      class="md-textarea"
      onselectionchange={syncSel}
      onmouseup={syncSel}
      onkeyup={syncSel}
      onkeydown={handleKeydown}
    ></textarea>
  {/if}
</div>

<style>
  .md-editor {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--bg-input);
  }

  .md-toolbar {
    display: flex;
    align-items: center;
    gap: 1px;
    padding: 4px 6px;
    border-bottom: 1px solid var(--border);
    background: var(--card-bg);
    flex-wrap: wrap;
    row-gap: 3px;
  }

  .md-btn {
    background: none;
    border: none;
    border-radius: 4px;
    padding: 3px 7px;
    font-size: 13px;
    cursor: pointer;
    color: var(--text);
    line-height: 1.5;
    min-width: 26px;
    transition: background 0.1s, color 0.1s;
  }
  .md-btn:hover { background: var(--bg-input); }

  /* Inline buttons glow when text is selected */
  .md-btn.sel {
    color: var(--accent);
    background: var(--accent-subtle);
  }
  .md-btn.sel:hover { filter: brightness(1.1); }

  .md-preview-btn { font-size: 12px; padding: 3px 9px; gap: 4px; }
  .md-preview-btn.active { background: var(--accent-subtle); color: var(--accent); }

  .md-sep {
    width: 1px;
    height: 16px;
    background: var(--border);
    margin: 0 4px;
    flex-shrink: 0;
    align-self: center;
  }
  .md-spacer { flex: 1; }

  .md-sel-hint {
    font-size: 11px;
    color: var(--accent);
    opacity: 0.8;
    white-space: nowrap;
    margin-right: 6px;
  }

  .md-textarea {
    display: block;
    width: 100%;
    border: none !important;
    border-radius: 0 !important;
    background: transparent !important;
    resize: vertical;
    font-family: inherit;
    font-size: 14px;
    padding: 0.6rem 0.75rem;
    box-sizing: border-box;
    outline: none !important;
    box-shadow: none !important;
    color: var(--text);
  }

  .md-preview-pane {
    padding: 0.65rem 0.75rem;
    min-height: 6rem;
  }

  .md-empty {
    font-size: 13px;
    color: var(--text-muted);
    font-style: italic;
  }
</style>
