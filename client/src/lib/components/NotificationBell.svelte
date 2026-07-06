<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '$lib/api';
  import type { Notification } from '$lib/types';

  let open = $state(false);
  let notifications = $state<Notification[]>([]);
  let unread = $derived(notifications.filter(n => !n.read).length);
  let panelEl = $state<HTMLDivElement | undefined>();
  let btnEl = $state<HTMLButtonElement | undefined>();

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function load() {
    try {
      notifications = await api.get<Notification[]>('/api/notifications');
    } catch { /* not logged in or network error */ }
  }

  async function markAllRead() {
    await api.put('/api/notifications/read-all', {});
    notifications = notifications.map(n => ({ ...n, read: 1 }));
  }

  async function dismiss(id: number) {
    await api.delete(`/api/notifications/${id}`);
    notifications = notifications.filter(n => n.id !== id);
  }

  async function markRead(id: number) {
    const n = notifications.find(n => n.id === id);
    if (!n || n.read) return;
    await api.put(`/api/notifications/${id}/read`, {});
    notifications = notifications.map(n => n.id === id ? { ...n, read: 1 } : n);
  }

  function toggle() { open = !open; }

  function onClickOutside(e: MouseEvent) {
    if (!open) return;
    if (panelEl?.contains(e.target as Node) || btnEl?.contains(e.target as Node)) return;
    open = false;
  }

  function relTime(iso: string) {
    const diff = (Date.now() - new Date(iso + 'Z').getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  const TYPE_ICON: Record<string, string> = {
    message:        'fa-solid fa-envelope',
    feedback_reply: 'fa-solid fa-reply',
    system:         'fa-solid fa-circle-info',
  };

  onMount(() => {
    load();
    pollTimer = setInterval(load, 60_000);
    document.addEventListener('click', onClickOutside, true);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
    document.removeEventListener('click', onClickOutside, true);
  });
</script>

<div class="nb-wrap">
  <button
    bind:this={btnEl}
    class="nb-btn"
    class:nb-btn-active={open}
    onclick={toggle}
    aria-label="Notifications"
  >
    <i class="fa-solid fa-bell"></i>
    {#if unread > 0}
      <span class="nb-badge">{unread > 99 ? '99+' : unread}</span>
    {/if}
  </button>

  {#if open}
    <div class="nb-panel" bind:this={panelEl}>
      <div class="nb-header">
        <span class="nb-header-title">Notifications</span>
        {#if unread > 0}
          <button class="nb-mark-all" onclick={markAllRead}>Mark all read</button>
        {/if}
      </div>

      {#if notifications.length === 0}
        <div class="nb-empty">
          <i class="fa-regular fa-bell-slash"></i>
          <p>No notifications yet</p>
        </div>
      {:else}
        <div class="nb-list">
          {#each notifications as n (n.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div class="nb-item" class:nb-item-unread={!n.read} onclick={() => markRead(n.id)}>
              <div class="nb-item-icon nb-icon-{n.type}">
                <i class={TYPE_ICON[n.type] ?? 'fa-solid fa-bell'}></i>
              </div>
              <div class="nb-item-body">
                <p class="nb-item-title">{n.title}</p>
                <p class="nb-item-text">{n.body}</p>
                <span class="nb-item-time">{relTime(n.created_at)}</span>
              </div>
              <button class="nb-dismiss" onclick={(e) => { e.stopPropagation(); dismiss(n.id); }} aria-label="Dismiss">×</button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .nb-wrap { position: relative; display: inline-flex; }

  .nb-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: var(--radius);
    padding: 0.35rem 0.55rem;
    font-size: 0.95rem;
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: center;
    transition: color 0.15s, border-color 0.15s;
  }
  .nb-btn:hover, .nb-btn-active { color: var(--text); border-color: var(--text-muted); }

  .nb-badge {
    position: absolute;
    top: -5px;
    right: -5px;
    background: var(--accent);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    min-width: 16px;
    height: 16px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
  }

  .nb-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 340px;
    max-height: 480px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    z-index: 500;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .nb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .nb-header-title { font-weight: 600; font-size: 14px; }
  .nb-mark-all {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 12px;
    cursor: pointer;
    padding: 0;
  }
  .nb-mark-all:hover { text-decoration: underline; }

  .nb-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2.5rem 1rem;
    color: var(--text-muted);
    font-size: 13px;
  }
  .nb-empty i { font-size: 1.75rem; }

  .nb-list { overflow-y: auto; flex: 1; }

  .nb-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: background 0.1s;
    position: relative;
  }
  .nb-item:last-child { border-bottom: none; }
  .nb-item:hover { background: color-mix(in srgb, var(--accent) 5%, transparent); }
  .nb-item-unread { background: color-mix(in srgb, var(--accent) 6%, transparent); }
  .nb-item-unread::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--accent);
    border-radius: 0 2px 2px 0;
  }

  .nb-item-icon {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .nb-icon-message        { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); }
  .nb-icon-feedback_reply { background: color-mix(in srgb, #22c55e 15%, transparent);       color: #22c55e; }
  .nb-icon-system         { background: color-mix(in srgb, #f59e0b 15%, transparent);       color: #f59e0b; }

  .nb-item-body { flex: 1; min-width: 0; }
  .nb-item-title { font-size: 13px; font-weight: 600; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nb-item-text { font-size: 12px; color: var(--text-muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .nb-item-time { font-size: 11px; color: var(--text-muted); margin-top: 3px; display: block; }

  .nb-dismiss {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 0 2px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .nb-item:hover .nb-dismiss { opacity: 1; }
  .nb-dismiss:hover { color: var(--text); }
</style>
