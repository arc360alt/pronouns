<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { user, waitForUser, dmsEnabled } from '$lib/stores';
  import { api } from '$lib/api';

  interface Conversation {
    id: number;
    user1_id: number;
    user2_id: number;
    user1_username: string;
    user2_username: string;
    last_message: string | null;
    last_message_at: string | null;
    unread_count: number;
  }

  interface Message {
    id: number;
    sender_id: number;
    sender_username: string;
    content: string;
    created_at: string;
  }

  interface DmRequest {
    id: number;
    from_user_id: number;
    from_username: string;
    created_at: string;
  }

  const OFF_PLATFORM_RE = /\badd me\b|discord(\.gg|\.com)?|phone\s*number|snap(chat)?|insta(gram)?|telegram|whatsapp|\bkik\b/i;

  let currentUser = $state<{ id: number; username: string } | null>(null);
  let conversations = $state<Conversation[]>([]);
  let requests = $state<DmRequest[]>([]);
  let activeConvId = $state<number | null>(null);
  let messages = $state<Message[]>([]);
  let messageText = $state('');
  let sendingMessage = $state(false);
  let loading = $state(true);
  let dmEnabled = $state(false);

  // New DM modal
  let showNewDm = $state(false);
  let newDmUsername = $state('');
  let newDmError = $state('');
  let newDmLoading = $state(false);
  let newDmSuccess = $state('');

  // Report modal
  let showReport = $state(false);
  let reportSending = $state(false);
  let reportDone = $state(false);

  // Mobile: hide sidebar when conversation open
  let mobileShowSidebar = $state(true);

  let messagesEl = $state<HTMLDivElement | null>(null);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  function otherUser(c: Conversation): string {
    return c.user1_id === currentUser?.id ? c.user2_username : c.user1_username;
  }

  function relTime(iso: string) {
    const diff = (Date.now() - new Date(iso + 'Z').getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  }

  function hasOffPlatformSignal(content: string) {
    return OFF_PLATFORM_RE.test(content);
  }

  async function loadConversations() {
    const [convs, reqs] = await Promise.all([
      api.get<Conversation[]>('/api/dm/conversations'),
      api.get<DmRequest[]>('/api/dm/requests'),
    ]);
    conversations = convs;
    requests = reqs;
  }

  async function openConversation(id: number) {
    activeConvId = id;
    mobileShowSidebar = false;
    await loadMessages();
    startPolling();
  }

  async function loadMessages() {
    if (!activeConvId) return;
    try {
      messages = await api.get<Message[]>(`/api/dm/conversations/${activeConvId}/messages`);
      // mark read in UI
      conversations = conversations.map(c => c.id === activeConvId ? { ...c, unread_count: 0 } : c);
      await tick();
      scrollToBottom();
    } catch {}
  }

  function scrollToBottom() {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
      loadMessages();
      loadConversations();
    }, 3000);
  }

  function stopPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  }

  async function sendMessage() {
    if (!messageText.trim() || !activeConvId || sendingMessage) return;
    const text = messageText;
    messageText = '';
    sendingMessage = true;
    try {
      await api.post(`/api/dm/conversations/${activeConvId}/messages`, { content: text });
      await loadMessages();
    } catch (e: unknown) {
      messageText = text;
      alert((e as Error).message);
    } finally {
      sendingMessage = false;
    }
  }

  async function acceptRequest(id: number) {
    try {
      const res = await api.post<{ ok: boolean; conversation_id: number }>(`/api/dm/requests/${id}/accept`);
      await loadConversations();
      openConversation(res.conversation_id);
    } catch {}
  }

  async function denyRequest(id: number) {
    try {
      await api.post(`/api/dm/requests/${id}/deny`);
      requests = requests.filter(r => r.id !== id);
    } catch {}
  }

  async function sendNewDmRequest() {
    newDmError = ''; newDmSuccess = '';
    if (!newDmUsername.trim()) return;
    newDmLoading = true;
    try {
      await api.post('/api/dm/requests', { username: newDmUsername.trim() });
      newDmSuccess = `Request sent to @${newDmUsername.trim()}!`;
      newDmUsername = '';
    } catch (e: unknown) {
      newDmError = (e as Error).message;
    } finally {
      newDmLoading = false;
    }
  }

  async function submitReport() {
    if (!activeConvId || reportSending) return;
    reportSending = true;
    try {
      await api.post(`/api/dm/conversations/${activeConvId}/report`);
      reportDone = true;
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      reportSending = false;
    }
  }

  async function toggleDmRequests() {
    dmEnabled = !dmEnabled;
    await api.put('/api/dm/settings', { dm_requests_enabled: dmEnabled });
  }

  onMount(async () => {
    const me = await waitForUser();
    if (!me) { goto('/login'); return; }
    // Check DM killswitch before loading anything
    try {
      const status = await api.get<{ enabled: boolean }>('/api/dm/status');
      dmsEnabled.set(status.enabled);
      if (!status.enabled) { loading = false; return; }
    } catch { loading = false; return; }
    currentUser = me;
    try {
      const [, settings] = await Promise.all([
        loadConversations(),
        api.get<{ dm_requests_enabled: number }>('/api/dm/settings'),
      ]);
      dmEnabled = !!settings.dm_requests_enabled;
    } catch {}
    loading = false;
  });

  onDestroy(() => stopPolling());
</script>

<svelte:head><title>Direct Messages — pronouns</title></svelte:head>

{#if !$dmsEnabled && !loading}
  <div class="container" style="max-width:480px;text-align:center;padding-top:4rem">
    <p style="font-size:4rem;margin-bottom:0.5rem">404</p>
    <h1 style="font-size:1.5rem;font-weight:700;margin-bottom:0.75rem">Page Not Found</h1>
    <p style="color:var(--text-muted);margin-bottom:1.5rem">This page doesn't exist.</p>
    <a href="/" class="btn btn-secondary">Go Home</a>
  </div>
{:else if !loading}
<div class="dm-root">
  <!-- Sidebar -->
  <aside class="dm-sidebar" class:dm-sidebar-hidden={!mobileShowSidebar}>
    <div class="dm-sidebar-header">
      <span class="dm-sidebar-title">Messages</span>
      <button class="btn btn-primary btn-sm" onclick={() => { showNewDm = true; newDmError = ''; newDmSuccess = ''; }}>
        <i class="fa-solid fa-plus"></i> New
      </button>
    </div>

    <div class="dm-settings-row">
      <span>Accept DM requests</span>
      <button class="dm-toggle {dmEnabled ? 'dm-toggle-on' : ''}" onclick={toggleDmRequests} title={dmEnabled ? 'Turn off DM requests' : 'Turn on DM requests'}>
        <span class="dm-toggle-knob"></span>
      </button>
    </div>

    {#if loading}
      <div class="dm-empty">Loading…</div>
    {:else}
      {#if requests.length > 0}
        <div class="dm-section-label">Pending requests</div>
        {#each requests as req (req.id)}
          <div class="dm-request-row">
            <i class="fa-solid fa-user-plus" style="color:var(--accent);font-size:13px"></i>
            <a href="/@{req.from_username}" class="dm-request-name">@{req.from_username}</a>
            <button class="btn btn-primary btn-sm dm-req-btn" onclick={() => acceptRequest(req.id)} title="Accept">
              <i class="fa-solid fa-check"></i>
            </button>
            <button class="btn btn-ghost btn-sm dm-req-btn" onclick={() => denyRequest(req.id)} title="Deny">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        {/each}
        <div class="dm-divider"></div>
      {/if}

      {#if conversations.length === 0}
        <div class="dm-empty">No conversations yet.<br>Send a DM request to get started.</div>
      {:else}
        {#each conversations as conv (conv.id)}
          <button
            class="dm-conv-row {activeConvId === conv.id ? 'dm-conv-active' : ''}"
            onclick={() => openConversation(conv.id)}
          >
            <div class="dm-conv-avatar">{otherUser(conv)[0].toUpperCase()}</div>
            <div class="dm-conv-info">
              <div class="dm-conv-name">
                @{otherUser(conv)}
                {#if conv.unread_count > 0}<span class="dm-unread-badge">{conv.unread_count}</span>{/if}
              </div>
              <div class="dm-conv-preview">{conv.last_message ?? 'No messages yet'}</div>
            </div>
            {#if conv.last_message_at}
              <span class="dm-conv-time">{relTime(conv.last_message_at)}</span>
            {/if}
          </button>
        {/each}
      {/if}
    {/if}
  </aside>

  <!-- Chat panel -->
  <main class="dm-chat" class:dm-chat-hidden={mobileShowSidebar && !activeConvId}>
    {#if !activeConvId}
      <div class="dm-empty dm-empty-center">
        <i class="fa-regular fa-comments" style="font-size:2.5rem;opacity:0.25;margin-bottom:0.75rem"></i>
        <div>Select a conversation to start chatting</div>
      </div>
    {:else}
      {@const activeConv = conversations.find(c => c.id === activeConvId)}
      <div class="dm-chat-header">
        <button class="dm-back-btn" onclick={() => { mobileShowSidebar = true; stopPolling(); }}>
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        {#if activeConv}
          <a href="/@{otherUser(activeConv)}" class="dm-chat-name">@{otherUser(activeConv)}</a>
        {/if}
        <div style="flex:1"></div>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);font-size:12px" onclick={() => { showReport = true; reportDone = false; }}>
          <i class="fa-solid fa-flag"></i> Report
        </button>
      </div>

      <div class="dm-messages" bind:this={messagesEl}>
        {#if messages.length === 0}
          <div class="dm-empty" style="margin-top:2rem">No messages yet. Say hello!</div>
        {/if}
        {#each messages as msg (msg.id)}
          {@const mine = msg.sender_id === currentUser?.id}
          {@const warn = hasOffPlatformSignal(msg.content)}
          <div class="dm-msg-group {mine ? 'dm-msg-group-mine' : ''}">
            <div class="dm-bubble {mine ? 'dm-bubble-mine' : 'dm-bubble-theirs'}">
              {msg.content}
            </div>
            {#if warn}
              <div class="dm-offplatform-warn">
                <i class="fa-solid fa-triangle-exclamation"></i>
                This user may be trying to bring you off platform. If you ever feel uncomfortable, please report this conversation.
              </div>
            {/if}
            <div class="dm-msg-time {mine ? 'dm-msg-time-mine' : ''}">{relTime(msg.created_at)}</div>
          </div>
        {/each}
      </div>

      <form class="dm-input-bar" onsubmit={(e) => { e.preventDefault(); sendMessage(); }}>
        <input
          class="dm-input"
          placeholder="Message…"
          bind:value={messageText}
          maxlength="2000"
          disabled={sendingMessage}
          onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
        />
        <button class="btn btn-primary" type="submit" disabled={!messageText.trim() || sendingMessage}>
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </form>
    {/if}
  </main>
</div>

<!-- New DM modal -->
{#if showNewDm}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={() => showNewDm = false}>
    <div class="modal-box" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header"><h3>Create Direct Message</h3></div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:1rem">
          Enter a username to send a DM request. They'll need to accept before you can message each other.
        </p>
        <form onsubmit={(e) => { e.preventDefault(); sendNewDmRequest(); }}>
          <div class="form-group">
            <label class="form-label" for="dm-username">Username</label>
            <input id="dm-username" class="form-input" placeholder="username" bind:value={newDmUsername} disabled={newDmLoading} />
          </div>
          {#if newDmError}<p style="color:var(--danger);font-size:13px;margin-top:0.5rem">{newDmError}</p>{/if}
          {#if newDmSuccess}<p style="color:var(--success);font-size:13px;margin-top:0.5rem">{newDmSuccess}</p>{/if}
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" onclick={() => showNewDm = false}>Cancel</button>
            <button type="submit" class="btn btn-primary" disabled={!newDmUsername.trim() || newDmLoading}>
              {newDmLoading ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Report modal -->
{#if showReport}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={() => showReport = false}>
    <div class="modal-box" onclick={(e) => e.stopPropagation()}>
      {#if reportDone}
        <div class="modal-body" style="text-align:center;padding-top:1.5rem">
          <i class="fa-solid fa-circle-check" style="font-size:2rem;color:var(--success);margin-bottom:0.75rem;display:block"></i>
          <h3 style="margin:0 0 0.5rem">Report submitted</h3>
          <p style="font-size:13px;color:var(--text-muted)">Our team will review this conversation and take action if needed. Thank you for keeping the community safe.</p>
          <button class="btn btn-primary" style="margin-top:1rem" onclick={() => showReport = false}>Done</button>
        </div>
      {:else}
        <div class="modal-header"><h3>Report Conversation</h3></div>
        <div class="modal-body">
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:0.75rem">
            Submitting a report will send your <strong>entire conversation</strong> to our admins for review. They can view all messages and may take action including banning the reported user.
          </p>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:1rem">
            Please only report genuine rule violations. Thank you for helping keep the community safe.
          </p>
          <div class="modal-actions">
            <button class="btn btn-ghost" onclick={() => showReport = false}>Cancel</button>
            <button class="btn btn-primary" style="background:var(--danger);border-color:var(--danger)" onclick={submitReport} disabled={reportSending}>
              {reportSending ? 'Sending…' : 'Report & Send Conversation'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
{/if}
