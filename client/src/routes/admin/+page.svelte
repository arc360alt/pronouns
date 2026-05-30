<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { user, waitForUser } from '$lib/stores';
  import { api } from '$lib/api';
  import Modal from '$lib/components/Modal.svelte';
  import PixLoader from '$lib/components/PixLoader.svelte';
  import type { Report, AdminUser, Badge } from '$lib/types';

  let tab = $state<'reports' | 'users' | 'banner'>('reports');
  let reports = $state<Report[]>([]);
  let users = $state<AdminUser[]>([]);
  let loading = $state(true);
  let msg = $state('');

  // Banner state
  let bannerActive = $state(false);
  let bannerText = $state('');
  let bannerColor = $state('#e07a27');
  let bannerBtnText = $state('');
  let bannerBtnUrl = $state('');
  let bannerSaving = $state(false);

  onMount(async () => {
    const me = await waitForUser();
    if (!me?.is_admin) { goto('/'); return; }
    await loadAll();
    loading = false;
  });

  async function loadAll() {
    const [r, u, b] = await Promise.all([
      api.get<Report[]>('/api/admin/reports'),
      api.get<AdminUser[]>('/api/admin/users'),
      api.get<{ active: boolean; text: string; color: string; btn_text: string; btn_url: string }>('/api/admin/banner'),
    ]);
    reports = r;
    users = u;
    bannerActive = b.active;
    bannerText = b.text;
    bannerColor = b.color || '#e07a27';
    bannerBtnText = b.btn_text || '';
    bannerBtnUrl = b.btn_url || '';
  }

  async function saveBanner() {
    bannerSaving = true;
    try {
      await api.put('/api/admin/banner', {
        active: bannerActive, text: bannerText, color: bannerColor,
        btn_text: bannerBtnText, btn_url: bannerBtnUrl,
      });
      showMsg('Banner saved');
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      bannerSaving = false;
    }
  }

  async function updateReport(id: number, status: string, admin_note?: string) {
    try {
      await api.put(`/api/admin/reports/${id}`, { status, admin_note });
      reports = reports.map(r => r.id === id ? { ...r, status: status as Report['status'], admin_note: admin_note || r.admin_note } : r);
      showMsg('Report updated');
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function toggleBan(u: AdminUser) {
    const banned = !u.is_banned;
    try {
      await api.put(`/api/admin/users/${u.id}/ban`, { banned });
      users = users.map(usr => usr.id === u.id ? { ...usr, is_banned: banned ? 1 : 0 } : usr);
      showMsg(banned ? `@${u.username} banned` : `@${u.username} unbanned`);
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function toggleAdmin(u: AdminUser) {
    const is_admin = !u.is_admin;
    try {
      await api.put(`/api/admin/users/${u.id}/admin`, { is_admin });
      users = users.map(usr => usr.id === u.id ? { ...usr, is_admin: is_admin ? 1 : 0 } : usr);
      showMsg(is_admin ? `@${u.username} is now admin` : `@${u.username} admin revoked`);
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function resetAiUsage(u: AdminUser) {
    try {
      await api.delete(`/api/admin/users/${u.id}/ai-usage`);
      showMsg(`AI usage reset for @${u.username}`);
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Failed');
    }
  }

  function showMsg(m: string) {
    msg = m;
    setTimeout(() => msg = '', 3000);
  }

  let pendingCount = $derived(reports.filter(r => r.status === 'pending').length);

  // Badge management modal
  let badgeModalUser = $state<AdminUser | null>(null);
  let allBadgeDefs = $state<Badge[]>([]);
  let userBadges = $state<Badge[]>([]);
  let badgeLoading = $state(false);

  async function openBadgeModal(u: AdminUser) {
    badgeModalUser = u;
    badgeLoading = true;
    try {
      const [defs, profile] = await Promise.all([
        api.get<Badge[]>('/api/admin/badges'),
        api.get<{ badges: Badge[] }>(`/api/users/${u.username}`),
      ]);
      allBadgeDefs = defs;
      userBadges = profile.badges;
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Failed to load badges');
    } finally {
      badgeLoading = false;
    }
  }

  function hasBadge(badgeId: string) {
    return userBadges.some(b => b.id === badgeId);
  }

  async function awardBadge(badgeId: string) {
    if (!badgeModalUser) return;
    try {
      await api.post(`/api/admin/users/${badgeModalUser.id}/badges/${badgeId}`, {});
      userBadges = [...userBadges.filter(b => b.id !== badgeId), { ...allBadgeDefs.find(d => d.id === badgeId)!, visible: true, sort_order: userBadges.length }];
      showMsg('Badge awarded');
    } catch (err) { showMsg(err instanceof Error ? err.message : 'Failed'); }
  }

  async function revokeBadge(badgeId: string) {
    if (!badgeModalUser) return;
    try {
      await api.delete(`/api/admin/users/${badgeModalUser.id}/badges/${badgeId}`);
      userBadges = userBadges.filter(b => b.id !== badgeId);
      showMsg('Badge revoked');
    } catch (err) { showMsg(err instanceof Error ? err.message : 'Failed'); }
  }
</script>

<svelte:head><title>Admin Panel — pronouns</title></svelte:head>

{#if loading}
  <div class="loading"><PixLoader /></div>
{:else}
<div class="container">
  <h1 class="page-title">Admin Panel</h1>

  {#if msg}<p class="msg-success" style="margin-bottom:1rem">{msg}</p>{/if}

  <div class="tabs">
    <button class="tab-btn" class:active={tab === 'reports'} onclick={() => tab = 'reports'}>
      Reports {#if pendingCount > 0}<span style="background:var(--danger);color:#fff;border-radius:999px;padding:0 6px;font-size:11px;margin-left:4px">{pendingCount}</span>{/if}
    </button>
    <button class="tab-btn" class:active={tab === 'users'} onclick={() => tab = 'users'}>
      Users ({users.length})
    </button>
    <button class="tab-btn" class:active={tab === 'banner'} onclick={() => tab = 'banner'}>
      Site Banner
    </button>
  </div>

  {#if tab === 'reports'}
    {#if reports.length === 0}
      <p style="color:var(--text-muted)">No reports yet.</p>
    {:else}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reported user</th>
              <th>Reporter</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each reports as r}
              <tr>
                <td>
                  {#if r.reported_username}
                    <a href="/@{r.reported_username}">@{r.reported_username}</a>
                  {:else}
                    <span style="color:var(--text-muted)">deleted</span>
                  {/if}
                </td>
                <td style="color:var(--text-muted)">{r.reporter_username ? '@' + r.reporter_username : 'anonymous'}</td>
                <td style="max-width:200px;word-break:break-word">{r.reason}</td>
                <td>
                  <span style="color:{r.status === 'pending' ? 'var(--danger)' : r.status === 'resolved' ? 'var(--success)' : 'var(--text-muted)'}">
                    {r.status}
                  </span>
                </td>
                <td style="white-space:nowrap;color:var(--text-muted)">{new Date(r.created_at).toLocaleDateString()}</td>
                <td>
                  <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
                    {#if r.status !== 'resolved'}
                      <button class="btn btn-sm" style="background:var(--success);color:#fff"
                        onclick={() => updateReport(r.id, 'resolved')}>Resolve</button>
                    {/if}
                    {#if r.status !== 'dismissed'}
                      <button class="btn btn-secondary btn-sm"
                        onclick={() => updateReport(r.id, 'dismissed')}>Dismiss</button>
                    {/if}
                    {#if r.status !== 'pending'}
                      <button class="btn btn-ghost btn-sm"
                        onclick={() => updateReport(r.id, 'pending')}>Reopen</button>
                    {/if}
                    {#if r.reported_username}
                      {@const reportedUser = users.find(u => u.username === r.reported_username)}
                      {#if reportedUser}
                        <button class="btn btn-danger btn-sm"
                          onclick={() => toggleBan(reportedUser)}>
                          {reportedUser.is_banned ? 'Unban' : 'Ban user'}
                        </button>
                      {/if}
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}

  {#if tab === 'users'}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Joined</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each users as u}
            <tr>
              <td>
                <a href="/@{u.username}">@{u.username}</a>
                {#if u.is_admin}<span style="font-size:11px;color:var(--accent);margin-left:4px">[admin]</span>{/if}
              </td>
              <td style="color:var(--text-muted)">{u.email}</td>
              <td style="color:var(--text-muted);white-space:nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
              <td>
                {#if u.is_banned}
                  <span style="color:var(--danger)">Banned</span>
                {:else}
                  <span style="color:var(--success)">Active</span>
                {/if}
              </td>
              <td>
                <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
                  {#if u.id !== $user?.id}
                    <button class="btn btn-sm {u.is_banned ? 'btn-secondary' : 'btn-danger'}"
                      onclick={() => toggleBan(u)}>
                      {u.is_banned ? 'Unban' : 'Ban'}
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick={() => toggleAdmin(u)}>
                      {u.is_admin ? 'Revoke admin' : 'Make admin'}
                    </button>
                  {:else}
                    <span style="font-size:12px;color:var(--text-muted)">(you)</span>
                  {/if}
                  <button class="btn btn-ghost btn-sm" onclick={() => resetAiUsage(u)}
                    title="Reset today's AI message limit">
                    Reset AI limit
                  </button>
                  <button class="btn btn-ghost btn-sm" onclick={() => openBadgeModal(u)}>
                    <i class="fa-solid fa-medal"></i> Badges
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
  {#if tab === 'banner'}
    <div class="card" style="max-width:520px">
      <p class="section-title">Site-wide Banner</p>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:1rem">
        Shown at the very top of every page. Useful for announcements or maintenance notices.
      </p>

      <!-- Live preview -->
      {#if bannerText}
        <div style="border-radius:var(--radius);overflow:hidden;margin-bottom:1.25rem">
          <div style="background:{bannerColor};display:flex;align-items:center;justify-content:center;gap:0.75rem;padding:0.5rem 1rem;font-size:13px;font-weight:500;color:#fff;position:relative;flex-wrap:wrap">
            <span style="flex:1;text-align:center">{bannerText}</span>
            {#if bannerBtnText && bannerBtnUrl}
              <span style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);border-radius:4px;padding:0.2rem 0.65rem;font-size:12px">{bannerBtnText}</span>
            {/if}
            <span style="position:absolute;right:0.6rem;opacity:0.7">×</span>
          </div>
        </div>
      {/if}

      <div class="form-group">
        <label class="form-label" for="b-active" style="flex-direction:row;align-items:center;gap:0.5rem">
          <input id="b-active" type="checkbox" bind:checked={bannerActive} style="width:auto" />
          Banner active (visible to all users)
        </label>
      </div>
      <div class="form-group">
        <label class="form-label" for="b-text">Banner text</label>
        <input id="b-text" type="text" bind:value={bannerText} placeholder="We're moving to a new server on June 1st!" />
      </div>
      <div class="form-group">
        <label class="form-label" for="b-color">Banner color</label>
        <div style="display:flex;gap:0.75rem;align-items:center">
          <input id="b-color" type="color" bind:value={bannerColor} style="width:48px;height:36px;padding:2px;cursor:pointer;flex:none" />
          <input type="text" bind:value={bannerColor} placeholder="#e07a27" style="flex:1" />
        </div>
      </div>
      <p class="form-label" style="margin-bottom:0.5rem">Button (optional)</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" for="b-btn-text">Button label</label>
          <input id="b-btn-text" type="text" bind:value={bannerBtnText} placeholder="Learn more" />
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" for="b-btn-url">Button URL</label>
          <input id="b-btn-url" type="url" bind:value={bannerBtnUrl} placeholder="https://..." />
        </div>
      </div>
      <button class="btn btn-primary" onclick={saveBanner} disabled={bannerSaving}>
        {bannerSaving ? 'Saving…' : 'Save banner'}
      </button>
    </div>
  {/if}
</div>
{/if}

<Modal open={!!badgeModalUser} title="Badges — @{badgeModalUser?.username ?? ''}" onClose={() => badgeModalUser = null}>
  {#snippet children()}
    {#if badgeLoading}
      <p style="color:var(--text-muted)">Loading…</p>
    {:else}
      <div style="display:flex;flex-direction:column;gap:0.5rem">
        {#each allBadgeDefs as def}
          {@const owned = hasBadge(def.id)}
          <div style="display:flex;align-items:center;gap:0.75rem;padding:0.4rem 0.5rem;border-radius:var(--radius);background:var(--card-bg);border:1px solid var(--border)">
            <span class="profile-badge" style="--badge-color:{def.color}">
              <i class="{def.icon}"></i> {def.name}
            </span>
            <span style="flex:1;font-size:12px;color:var(--text-muted)">{def.description}</span>
            {#if owned}
              <button class="btn btn-danger btn-sm" onclick={() => revokeBadge(def.id)}>Revoke</button>
            {:else}
              <button class="btn btn-sm" style="background:var(--success);color:#fff" onclick={() => awardBadge(def.id)}>Award</button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/snippet}
</Modal>
