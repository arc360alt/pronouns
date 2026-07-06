<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { waitForUser } from '$lib/stores';
  import { notifUnread } from '$lib/stores';
  import { api } from '$lib/api';
  import type { Notification } from '$lib/types';

  let notifications = $state<Notification[]>([]);
  let loading = $state(true);

  const TYPE_ICON: Record<string, string> = {
    message:        'fa-solid fa-envelope',
    feedback_reply: 'fa-solid fa-reply',
    system:         'fa-solid fa-circle-info',
  };

  function relTime(iso: string) {
    const diff = (Date.now() - new Date(iso + 'Z').getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(iso + 'Z').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function markAllRead() {
    await api.put('/api/notifications/read-all', {});
    notifications = notifications.map(n => ({ ...n, read: 1 }));
    notifUnread.set(0);
  }

  async function dismiss(id: number) {
    await api.delete(`/api/notifications/${id}`);
    const wasUnread = notifications.find(n => n.id === id && !n.read);
    notifications = notifications.filter(n => n.id !== id);
    if (wasUnread) notifUnread.update(c => Math.max(0, c - 1));
  }

  onMount(async () => {
    const me = await waitForUser();
    if (!me) { goto('/login'); return; }
    try {
      notifications = await api.get<Notification[]>('/api/notifications');
      // Mark all read on open
      if (notifications.some(n => !n.read)) {
        await api.put('/api/notifications/read-all', {});
        notifications = notifications.map(n => ({ ...n, read: 1 }));
        notifUnread.set(0);
      }
    } catch {}
    loading = false;
  });
</script>

<svelte:head><title>Notifications — pronouns</title></svelte:head>

<div class="container" style="max-width:680px;padding-top:2rem">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.75rem">
    <h1 class="page-title" style="margin:0">
      <i class="fa-solid fa-bell" style="color:var(--accent);margin-right:0.4rem"></i>
      Notifications
    </h1>
    {#if notifications.length > 0}
      <button class="btn btn-ghost btn-sm" onclick={markAllRead}>
        <i class="fa-solid fa-check-double"></i> Mark all read
      </button>
    {/if}
  </div>

  {#if loading}
    <div style="text-align:center;padding:3rem;color:var(--text-muted)">
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.5rem"></i>
    </div>
  {:else if notifications.length === 0}
    <div class="card" style="display:flex;flex-direction:column;align-items:center;text-align:center;padding:3rem 2rem;gap:0.5rem">
      <i class="fa-regular fa-bell-slash" style="font-size:2.5rem;color:var(--text-muted)"></i>
      <p style="font-weight:600;margin-top:0.5rem">Nothing here yet</p>
      <p style="font-size:14px;color:var(--text-muted)">Notifications from admins, feedback replies, and badges will show up here.</p>
    </div>
  {:else}
    <div class="notif-list">
      {#each notifications as n (n.id)}
        <div class="notif-item">
          <div class="notif-icon notif-icon-{n.type}">
            <i class={TYPE_ICON[n.type] ?? 'fa-solid fa-bell'}></i>
          </div>
          <div class="notif-body">
            <p class="notif-title">{n.title}</p>
            <p class="notif-text">{n.body}</p>
            <span class="notif-time">{relTime(n.created_at)}</span>
          </div>
          <button class="notif-dismiss" onclick={() => dismiss(n.id)} aria-label="Dismiss">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .notif-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .notif-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem 1rem 1rem 1rem;
  }

  .notif-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .notif-icon-message        { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); }
  .notif-icon-feedback_reply { background: color-mix(in srgb, #22c55e 15%, transparent);       color: #22c55e; }
  .notif-icon-system         { background: color-mix(in srgb, #f59e0b 15%, transparent);       color: #f59e0b; }

  .notif-body { flex: 1; min-width: 0; }
  .notif-title { font-weight: 600; font-size: 14px; margin-bottom: 0.25rem; }
  .notif-text  { font-size: 13px; color: var(--text-muted); line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
  .notif-time  { font-size: 12px; color: var(--text-muted); margin-top: 0.4rem; display: block; }

  .notif-dismiss {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.2rem 0.3rem;
    border-radius: var(--radius);
    font-size: 13px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s;
  }
  .notif-item:hover .notif-dismiss { opacity: 1; }
  .notif-dismiss:hover { color: var(--danger); }
</style>
