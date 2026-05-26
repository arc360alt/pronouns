<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { user, waitForUser } from '$lib/stores';
  import { api } from '$lib/api';
  import type { SiteFile } from '$lib/types';
  import MonacoEditor from '$lib/components/MonacoEditor.svelte';

  const LIMITS = { html: 5, css: 2, js: 1 };
  const FILE_ICON: Record<string, string> = { html: 'fa-code', css: 'fa-palette', js: 'fa-js' };

  let enabled = $state(false);
  let files = $state<SiteFile[]>([]);
  let selectedFile = $state<SiteFile & { content: string } | null>(null);
  let editorValue = $state('');
  let dirty = $state(false);
  let loading = $state(true);
  let saving = $state(false);
  let toggling = $state(false);
  let msg = $state('');
  let msgErr = $state(false);

  let addingFileType = $state<'html' | 'css' | 'js' | null>(null);
  let newBaseName = $state('');
  let newFileErr = $state('');

  let siteUrl = $derived($user ? `${location.origin}/sites/${$user.username}/` : '');

  const htmlCount = $derived(files.filter(f => f.filetype === 'html').length);
  const cssCount = $derived(files.filter(f => f.filetype === 'css').length);
  const jsCount = $derived(files.filter(f => f.filetype === 'js').length);

  onMount(async () => {
    if (!await waitForUser()) { goto('/login'); return; }
    await loadStatus();
    loading = false;
  });

  async function loadStatus() {
    const data = await api.get<{ enabled: boolean; files: SiteFile[] }>('/api/sitebuilder/status');
    enabled = data.enabled;
    files = data.files;
  }

  async function toggleSite() {
    toggling = true;
    try {
      if (enabled) {
        await api.delete('/api/sitebuilder/disable');
        enabled = false;
        showMsg('Site disabled');
      } else {
        const data = await api.post<{ enabled: boolean; files: SiteFile[] }>('/api/sitebuilder/enable', {});
        enabled = data.enabled;
        files = data.files;
        showMsg('Site enabled! Your default files are ready to edit.');
      }
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Failed', true);
    } finally {
      toggling = false;
    }
  }

  async function selectFile(f: SiteFile) {
    if (dirty && selectedFile) {
      if (!confirm('You have unsaved changes. Discard them?')) return;
    }
    const full = await api.get<SiteFile & { content: string }>(`/api/sitebuilder/files/${f.id}`);
    selectedFile = full;
    editorValue = full.content;
    dirty = false;
  }

  async function saveFile() {
    if (!selectedFile) return;
    saving = true;
    try {
      await api.put(`/api/sitebuilder/files/${selectedFile.id}`, { content: editorValue });
      dirty = false;
      previewKey++;
      showMsg('Saved');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Save failed', true);
    } finally {
      saving = false;
    }
  }

  async function addFile() {
    newFileErr = '';
    if (!addingFileType) return;
    const base = newBaseName.trim();
    if (!base) { newFileErr = 'Enter a name'; return; }
    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(base)) { newFileErr = 'Use letters, numbers, hyphens, underscores only'; return; }
    const filename = `${base}.${addingFileType}`;
    try {
      const f = await api.post<SiteFile>('/api/sitebuilder/files', { filename });
      files = [...files, f].sort((a, b) => a.filetype.localeCompare(b.filetype) || a.filename.localeCompare(b.filename));
      addingFileType = null;
      newBaseName = '';
      selectFile(f);
    } catch (e) {
      newFileErr = e instanceof Error ? e.message : 'Failed';
    }
  }

  function cancelAdd() { addingFileType = null; newBaseName = ''; newFileErr = ''; }
  function focus(node: HTMLElement) { node.focus(); }

  async function deleteFile(f: SiteFile, ev: MouseEvent) {
    ev.stopPropagation();
    if (!confirm(`Delete ${f.filename}?`)) return;
    try {
      await api.delete(`/api/sitebuilder/files/${f.id}`);
      files = files.filter(x => x.id !== f.id);
      if (selectedFile?.id === f.id) { selectedFile = null; editorValue = ''; dirty = false; }
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Failed', true);
    }
  }

  function showMsg(m: string, err = false) {
    msg = m; msgErr = err;
    setTimeout(() => msg = '', 3000);
  }

  function onEditorChange(v: string) {
    editorValue = v;
    dirty = true;
  }

  function langForFile(filename: string) {
    const ext = filename.split('.').pop();
    if (ext === 'css') return 'css';
    if (ext === 'js') return 'javascript';
    return 'html';
  }

  // ── AI chat ──────────────────────────────────────────────────────────────
  type ChatMsg = { role: 'user' | 'ai'; text: string; actions?: FileAction[] };
  type FileAction = { type: 'created' | 'updated' | 'deleted'; filename: string };

  let aiOpen = $state(false);
  let chatMessages = $state<ChatMsg[]>([]);
  let chatInput = $state('');
  let chatLoading = $state(false);
  let aiRemaining = $state<number | null>(null);
  let chatContainer: HTMLElement | undefined = $state();

  async function loadAiUsage() {
    try {
      const d = await api.get<{ remaining: number }>('/api/sitebuilder/ai/usage');
      aiRemaining = d.remaining;
    } catch { /* ignore */ }
  }

  async function openAi() {
    aiOpen = true;
    if (aiRemaining === null) await loadAiUsage();
    if (chatMessages.length === 0) {
      chatMessages = [{ role: 'ai', text: "Hi! I can help you build and edit your site. Tell me what you'd like to create, and I'll write the code and set up the files for you." }];
    }
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    chatInput = '';
    chatMessages = [...chatMessages, { role: 'user', text }];
    chatLoading = true;
    scrollChat();

    const allHistory = chatMessages
      .slice(0, -1)
      .map(m => ({ role: m.role === 'ai' ? 'model' : 'user' as const, text: m.text }));
    const firstUser = allHistory.findIndex(m => m.role === 'user');
    const history = firstUser >= 0 ? allHistory.slice(firstUser) : [];

    try {
      const { jobId } = await api.post<{ jobId: string }>('/api/sitebuilder/ai/chat', { message: text, history });

      type PollResponse =
        | { status: 'pending' }
        | { status: 'error'; error: string }
        | { status: 'done'; reply: string; actions: FileAction[]; files: SiteFile[]; remaining: number };

      let res: Extract<PollResponse, { status: 'done' }> | null = null;
      while (true) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await api.get<PollResponse>(`/api/sitebuilder/ai/status/${jobId}`);
        if (poll.status === 'error') throw new Error(poll.error ?? 'AI processing failed');
        if (poll.status === 'done') { res = poll; break; }
      }
      if (!res) throw new Error('No response received');

      chatMessages = [...chatMessages, { role: 'ai', text: res.reply, actions: res.actions }];
      aiRemaining = res.remaining;
      if (res.files) files = res.files;
      if (selectedFile && res.actions?.length) {
        const action = res.actions.find(a => a.filename === selectedFile!.filename);
        if (action) {
          if (action.type === 'deleted') {
            selectedFile = null;
            editorValue = '';
            dirty = false;
          } else {
            const meta = res.files?.find(f => f.filename === selectedFile!.filename);
            if (meta) {
              const full = await api.get<SiteFile & { content: string }>(`/api/sitebuilder/files/${meta.id}`);
              selectedFile = full;
              editorValue = full.content;
              dirty = false;
            }
          }
        }
      }
    } catch (e) {
      chatMessages = [...chatMessages, { role: 'ai', text: `Error: ${e instanceof Error ? e.message : 'Failed'}` }];
    } finally {
      chatLoading = false;
      scrollChat();
    }
  }

  function scrollChat() {
    setTimeout(() => { if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight; }, 30);
  }

  const ACTION_ICONS: Record<string, string> = { created: 'fa-plus', updated: 'fa-pen', deleted: 'fa-trash' };
  const ACTION_COLORS: Record<string, string> = { created: 'var(--success)', updated: 'var(--accent)', deleted: 'var(--danger)' };

  // ── Preview ──────────────────────────────────────────────────────────────
  let previewOpen = $state(false);
  let previewKey  = $state(0);

  const previewUrl = $derived(
    !$user ? '' : (() => {
      const htmlFilename = selectedFile?.filetype === 'html'
        ? selectedFile.filename
        : (files.find(f => f.filetype === 'html' && f.filename === 'index.html') ?? files.find(f => f.filetype === 'html'))?.filename;
      return htmlFilename ? `/sites/${$user!.username}/${htmlFilename}` : '';
    })()
  );
</script>

<svelte:head><title>My Site — pronouns</title></svelte:head>

<div class="container" style="max-width:{previewOpen ? '1700px' : '1000px'};transition:max-width 0.2s">
  <h1 class="page-title">My Site</h1>
  <p style="color:var(--text-muted);margin-bottom:1.5rem;font-size:14px">
    Host your own personal HTML site. You can add up to 5 HTML, 2 CSS, and 1 JS file. Need help with coding? Check out w3schools wich will teach you everything about coding websites! (Or you can just use an AI like claude idrc)
  </p>

  {#if msg}
    <p class="msg-{msgErr ? 'error' : 'success'}" style="margin-bottom:1rem">{msg}</p>
  {/if}

  {#if loading}
    <div class="loading">Loading…</div>
  {:else}
    <!-- Status card -->
    <div class="card" style="margin-bottom:1.25rem">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem">
        <div>
          <p class="section-title" style="margin-bottom:0.25rem">Site status</p>
          <p style="font-size:13px;color:{enabled ? 'var(--success)' : 'var(--text-muted)'}">
            {enabled ? 'Active — your site is publicly accessible' : 'Disabled — site is hidden from visitors'}
          </p>
        </div>
        <button class="btn {enabled ? 'btn-secondary' : 'btn-primary'}" onclick={toggleSite} disabled={toggling}>
          <i class="fa-solid fa-{enabled ? 'eye-slash' : 'globe'}"></i>
          {toggling ? '…' : enabled ? 'Disable site' : 'Enable site'}
        </button>
      </div>
      {#if enabled}
        <div style="margin-top:0.75rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
          <span style="font-size:13px;color:var(--text-muted)">Your site URL:</span>
          <code style="font-size:12px;background:var(--bg-input);border:1px solid var(--border);border-radius:4px;padding:0.15rem 0.5rem">{siteUrl}</code>
          <a href={siteUrl} target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
          </a>
        </div>
      {/if}
    </div>

    {#if enabled}
      <div style="display:flex;gap:1rem;align-items:flex-start">
      <!-- Editor layout -->
      <div class="card" style="padding:0;overflow:hidden;flex:1;min-width:0">
        <div style="display:flex;height:680px;min-height:0">

          <!-- File sidebar -->
          <div style="width:185px;flex-shrink:0;border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden">
            <div style="padding:0.75rem 0.75rem 0.5rem;border-bottom:1px solid var(--border)">
              <p style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Files</p>
            </div>
            <div style="flex:1;overflow-y:auto;padding:0.4rem 0">
              {#each files as f}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div
                  class="site-file-item"
                  class:active={selectedFile?.id === f.id}
                  onclick={() => selectFile(f)}
                  title={f.filename}
                  role="button"
                  tabindex="0"
                >
                  <i class="fa-{f.filetype === 'js' ? 'brands' : 'solid'} {FILE_ICON[f.filetype]}"
                     style="color:{f.filetype === 'html' ? 'var(--accent)' : f.filetype === 'css' ? '#7ec8e3' : '#f7df1e'};font-size:12px;flex-shrink:0"></i>
                  <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px">{f.filename}</span>
                  <button class="site-file-del" onclick={(e) => deleteFile(f, e)} title="Delete {f.filename}" tabindex="-1">×</button>
                </div>
              {:else}
                <p style="padding:0.75rem;font-size:12px;color:var(--text-muted)">No files yet</p>
              {/each}
            </div>


            <!-- Add file -->
            <div style="border-top:1px solid var(--border);padding:0.5rem">
              {#if addingFileType}
                <div style="display:flex;flex-direction:column;gap:0.35rem">
                  <div style="display:flex;align-items:center;gap:0.3rem;font-size:12px;color:var(--text-muted)">
                    <i class="fa-{addingFileType === 'js' ? 'brands fa-js' : 'solid'} {addingFileType === 'html' ? 'fa-code' : addingFileType === 'css' ? 'fa-palette' : ''}"
                       style="color:{addingFileType === 'html' ? 'var(--accent)' : addingFileType === 'css' ? '#7ec8e3' : '#f7df1e'}"></i>
                    <span>.{addingFileType}</span>
                  </div>
                  <div style="display:flex;gap:0.3rem;align-items:center">
                    <input
                      type="text"
                      bind:value={newBaseName}
                      placeholder="filename"
                      style="flex:1;font-size:12px;padding:0.3rem 0.45rem"
                      onkeydown={(e) => { if (e.key === 'Enter') addFile(); if (e.key === 'Escape') cancelAdd(); }}
                      use:focus
                    />
                    <span style="font-size:12px;color:var(--text-muted);flex-shrink:0">.{addingFileType}</span>
                  </div>
                  {#if newFileErr}<p style="font-size:11px;color:var(--danger)">{newFileErr}</p>{/if}
                  <div style="display:flex;gap:0.3rem">
                    <button class="btn btn-primary btn-sm" style="flex:1;font-size:12px" onclick={addFile} disabled={!newBaseName.trim()}>
                      Create
                    </button>
                    <button class="btn btn-ghost btn-sm" style="font-size:12px" onclick={cancelAdd}>✕</button>
                  </div>
                </div>
              {:else}
                <div style="display:flex;flex-direction:column;gap:0.25rem">
                  {#each (['html', 'css', 'js'] as const) as ext}
                    {@const count = ext === 'html' ? htmlCount : ext === 'css' ? cssCount : jsCount}
                    {@const atLimit = count >= LIMITS[ext]}
                    <button
                      class="btn btn-ghost btn-sm"
                      style="width:100%;font-size:12px;justify-content:space-between;opacity:{atLimit ? 0.4 : 1}"
                      onclick={() => { if (!atLimit) { addingFileType = ext; newFileErr = ''; } }}
                      disabled={atLimit}
                      title={atLimit ? `Limit reached (${LIMITS[ext]} max)` : `New .${ext} file`}
                    >
                      <span>
                        <i class="fa-{ext === 'js' ? 'brands fa-js' : 'solid'} {ext === 'html' ? 'fa-code' : ext === 'css' ? 'fa-palette' : ''}"
                           style="color:{ext === 'html' ? 'var(--accent)' : ext === 'css' ? '#7ec8e3' : '#f7df1e'};margin-right:0.3rem"></i>.{ext}
                      </span>
                      <span style="color:var(--text-muted)">{count}/{LIMITS[ext]}</span>
                    </button>
                  {/each}
                </div>
              {/if}

            </div>

            <!-- AI button -->
            <div style="padding:0.4rem 0.5rem;border-top:1px solid var(--border)">
              <button
                class="btn btn-sm"
                class:btn-primary={aiOpen}
                class:btn-ghost={!aiOpen}
                style="width:100%;font-size:12px"
                onclick={() => { if (aiOpen) { aiOpen = false; } else { openAi(); } }}
              >
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                AI Assistant
                {#if aiRemaining !== null}<span style="opacity:0.7;margin-left:0.25rem">({aiRemaining}/{20})</span>{/if}
              </button>
            </div>
          </div>

          <!-- Editor / AI pane -->
          <div style="flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden">
            {#if aiOpen}
              <!-- ── AI chat ── -->
              <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;border-bottom:1px solid var(--border);background:var(--bg-input);gap:0.5rem;flex-shrink:0">
                <span style="font-size:13px;font-weight:500;color:var(--text)">
                  <i class="fa-solid fa-wand-magic-sparkles" style="color:var(--accent);margin-right:0.4rem"></i>AI Assistant
                </span>
                <div style="display:flex;align-items:center;gap:0.5rem">
                  {#if aiRemaining !== null}
                    <span style="font-size:11px;color:var(--text-muted)">{aiRemaining} msg{aiRemaining === 1 ? '' : 's'} left today</span>
                  {/if}
                  <button class="btn btn-ghost btn-sm" style="font-size:12px" onclick={() => aiOpen = false}>
                    <i class="fa-solid fa-xmark"></i> Editor
                  </button>
                </div>
              </div>

              <!-- Messages -->
              <div bind:this={chatContainer} style="flex:1;overflow-y:auto;padding:0.75rem;display:flex;flex-direction:column;gap:0.6rem">
                {#each chatMessages as m}
                  <div style="display:flex;flex-direction:column;align-items:{m.role === 'user' ? 'flex-end' : 'flex-start'};gap:0.25rem">
                    <div style="max-width:88%;background:{m.role === 'user' ? 'var(--accent)' : 'var(--bg-input)'};color:{m.role === 'user' ? '#fff' : 'var(--text)'};border-radius:10px;padding:0.5rem 0.75rem;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word">
                      {m.text}
                    </div>
                    {#if m.actions && m.actions.length > 0}
                      <div style="display:flex;flex-wrap:wrap;gap:0.3rem;max-width:88%">
                        {#each m.actions as a}
                          <span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:11px;padding:0.15rem 0.5rem;border-radius:999px;background:var(--bg-card);border:1px solid var(--border);color:{ACTION_COLORS[a.type]}">
                            <i class="fa-solid {ACTION_ICONS[a.type]}"></i>
                            {a.type} {a.filename}
                          </span>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
                {#if chatLoading}
                  <div style="display:flex;align-items:flex-start">
                    <div style="background:var(--bg-input);border-radius:10px;padding:0.5rem 0.75rem;font-size:13px;color:var(--text-muted)">
                      <i class="fa-solid fa-circle-notch fa-spin"></i> Thinking…
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Input -->
              <div style="border-top:1px solid var(--border);padding:0.5rem;display:flex;gap:0.4rem;flex-shrink:0">
                <input
                  type="text"
                  bind:value={chatInput}
                  placeholder={aiRemaining === 0 ? 'Daily limit reached' : 'Ask AI to build or edit your site…'}
                  disabled={chatLoading || aiRemaining === 0}
                  style="flex:1;font-size:13px"
                  onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) sendChat(); }}
                />
                <button class="btn btn-primary btn-sm" aria-label="Send" onclick={sendChat} disabled={chatLoading || !chatInput.trim() || aiRemaining === 0}>
                  <i class="fa-solid fa-paper-plane"></i>
                </button>
              </div>
            {:else}
              <!-- ── Monaco editor ── -->
              {#if selectedFile}
                <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;border-bottom:1px solid var(--border);background:var(--bg-input);gap:0.5rem;flex-shrink:0">
                  <span style="font-size:13px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    <i class="fa-{selectedFile.filetype === 'js' ? 'brands' : 'solid'} {FILE_ICON[selectedFile.filetype]}"
                       style="color:{selectedFile.filetype === 'html' ? 'var(--accent)' : selectedFile.filetype === 'css' ? '#7ec8e3' : '#f7df1e'};margin-right:0.4rem"></i>{selectedFile.filename}
                    {#if dirty}<span style="font-size:11px;color:var(--text-muted);margin-left:0.3rem">(unsaved)</span>{/if}
                  </span>
                  <div style="display:flex;gap:0.4rem;flex-shrink:0">
                    <button class="btn btn-ghost btn-sm" onclick={() => previewOpen = !previewOpen}
                      title="{previewOpen ? 'Hide preview' : 'Show preview'}" style="font-size:12px">
                      <i class="fa-solid fa-{previewOpen ? 'eye-slash' : 'eye'}"></i>
                      {previewOpen ? 'Hide preview' : 'Preview'}
                    </button>
                    <button class="btn btn-primary btn-sm" onclick={saveFile} disabled={saving || !dirty}>
                      <i class="fa-solid fa-floppy-disk"></i>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
                <div style="flex:1;min-height:0">
                  {#key selectedFile?.id}
                    <MonacoEditor
                      value={editorValue}
                      language={langForFile(selectedFile.filename)}
                      onchange={onEditorChange}
                    />
                  {/key}
                </div>
              {:else}
                <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:0.75rem;color:var(--text-muted)">
                  <i class="fa-solid fa-code" style="font-size:2rem;opacity:0.3"></i>
                  <p style="font-size:14px">Select a file to edit</p>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>

      <!-- Preview panel — sits beside the editor card, same height -->
      {#if previewOpen}
        <div class="card preview-card" style="padding:0;overflow:hidden;display:flex;flex-direction:column;height:680px;width:600px;flex-shrink:0">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0.75rem;border-bottom:1px solid var(--border);background:var(--bg-input);flex-shrink:0">
            <span style="font-size:12px;color:var(--text-muted)">
              <i class="fa-solid fa-eye" style="margin-right:0.35rem"></i>Preview
            </span>
            {#if previewUrl}
              <a href={previewUrl} target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="font-size:11px">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
              </a>
            {/if}
          </div>
          {#if previewUrl}
            {#key previewKey}
              <iframe
                src={previewUrl}
                title="Site preview"
                sandbox="allow-scripts allow-same-origin allow-forms"
                style="flex:1;border:none;width:100%;height:100%;background:#fff"
              ></iframe>
            {/key}
          {:else}
            <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:0.5rem;color:var(--text-muted)">
              <i class="fa-solid fa-file-code" style="font-size:1.5rem;opacity:0.3"></i>
              <p style="font-size:13px">No HTML file yet</p>
            </div>
          {/if}
        </div>
      {/if}
      </div> <!-- end flex row -->
    {/if}
  {/if}
</div>

<style>
  .site-file-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.6rem;
    width: 100%;
    background: none;
    border: none;
    border-radius: 0;
    cursor: pointer;
    text-align: left;
    color: var(--text);
    transition: background 0.1s;
    min-width: 0;
  }
  .site-file-item:hover { background: var(--bg-input); }
  .site-file-item.active { background: var(--accent-subtle); }
  .site-file-del {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0;
    min-width: 0;
  }
  .site-file-item:hover .site-file-del { opacity: 1; }
  .site-file-del:hover { color: var(--danger); }
</style>
