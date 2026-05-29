<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { user } from '$lib/stores';
  import { api } from '$lib/api';
  import Modal from '$lib/components/Modal.svelte';
  import type { Profile } from '$lib/types';
  import { renderMarkdown } from '$lib/markdown';

  const isVideo = (url?: string | null) => !!(url && url.toLowerCase().endsWith('.mp4'));

  let profile = $state<Profile | null>(null);
  let loading = $state(true);
  let notFound = $state(false);
  let banned = $state(false);
  let reportOpen = $state(false);
  let reportReason = $state('');
  let reportMsg = $state('');
  let reportLoading = $state(false);
  let customStyle = $state('');
  let currentTime = $state('');
  let lightboxSrc = $state<string | null>(null);
  let lightboxCaption = $state<string | null>(null);

  let linkWarningOpen = $state(false);
  let pendingLink = $state('');

  function interceptBioLink(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href === '#') return;
    e.preventDefault();
    pendingLink = href;
    linkWarningOpen = true;
  }

  function linkDomain(url: string): string {
    try { return new URL(url).hostname; }
    catch { return url; }
  }

  function openPendingLink() {
    window.open(pendingLink, '_blank', 'noopener,noreferrer');
    linkWarningOpen = false;
    pendingLink = '';
  }

  // Section ordering & drag state
  const DEFAULT_SECTIONS = ['names', 'bio', 'flags', 'images', 'links', 'clock', 'friends'];
  let sectionOrder = $state<string[]>([]);
  let dragId = $state<string | null>(null);
  let dragOverId = $state<string | null>(null);
  let _dragTimer: ReturnType<typeof setTimeout> | null = null;
  let _pendingTarget: string | null = null;

  $effect(() => {
    if (!profile) return;
    const saved: string[] = (() => {
      try { return JSON.parse(profile.section_order ?? '[]'); } catch { return []; }
    })();
    const allIds = [
      ...DEFAULT_SECTIONS.filter(id => id !== 'links' && id !== 'clock' && id !== 'friends'),
      ...profile.custom_fields.map(f => `field:${f.id}`),
      'links', 'clock', 'friends',
    ];
    sectionOrder = [
      ...saved.filter(id => allIds.includes(id)),
      ...allIds.filter(id => !saved.includes(id)),
    ];
  });

  function sectionVisible(id: string): boolean {
    if (!profile) return false;
    if (id === 'names') return profile.names.length > 0;
    if (id === 'bio') return !!profile.bio;
    if (id === 'flags') return profile.flags.length > 0;
    if (id === 'images') return profile.images.length > 0;
    if (id === 'links') return !!(profile.links.length > 0 || profile.website || (profile.show_site && profile.site_enabled));
    if (id === 'clock') return !!(profile.timezone);
    if (id === 'friends') return !!(profile.show_friends && profile.friends.length > 0);
    if (id.startsWith('field:')) {
      const fid = parseInt(id.slice(6));
      const field = profile.custom_fields.find(f => f.id === fid);
      return !!(field && field.entries.length > 0);
    }
    return false;
  }

  function onDragStart(e: DragEvent, id: string) {
    dragId = id;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e: DragEvent, id: string) {
    e.preventDefault();
    if (!dragId || dragId === id) return;
    dragOverId = id;
    if (_pendingTarget === id) return; // already queued for this target
    if (_dragTimer) clearTimeout(_dragTimer);
    _pendingTarget = id;
    _dragTimer = setTimeout(() => {
      const target = _pendingTarget;
      if (!dragId || !target) return;
      const from = sectionOrder.indexOf(dragId);
      const to = sectionOrder.indexOf(target);
      if (from !== -1 && to !== -1 && from !== to) {
        const next = [...sectionOrder];
        next.splice(from, 1);
        next.splice(to, 0, dragId);
        sectionOrder = next;
      }
      _pendingTarget = null;
    }, 100);
  }

  function onDrop(e: DragEvent) { e.preventDefault(); }

  function onDragEnd() {
    if (_dragTimer) clearTimeout(_dragTimer);
    _pendingTarget = null;
    _dragTimer = null;
    if (dragId) {
      api.put('/api/profile/section-order', { section_order: JSON.stringify(sectionOrder) }).catch(() => {});
    }
    dragId = null;
    dragOverId = null;
  }

  $effect(() => {
    if (!profile?.timezone) return;
    const tz = profile.timezone;
    const fmt = new Intl.DateTimeFormat('en', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true, timeZone: tz
    });
    const tick = () => { currentTime = fmt.format(new Date()); };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  });

  function ordinal(n: number): string {
    const s = ['th','st','nd','rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
  }

  function formatBirthday(raw: string): string {
    try {
      const d = new Date(raw + 'T00:00:00Z');
      const month = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(d);
      const day = ordinal(d.getUTCDate());
      const year = d.getUTCFullYear();
      return `${month} ${day}, ${year}`;
    } catch { return raw; }
  }

  let isOwnProfile = $derived(
    !!$user && profile ? $user.username.toLowerCase() === profile.username.toLowerCase() : false
  );

  let bannerHeightPx = $derived(Math.min(400, Math.max(100, profile?.banner_height ?? 240)));
  let avatarSizePx = $derived(Math.min(180, Math.max(60, profile?.avatar_size ?? 120)));

  onMount(async () => {
    const username = $page.params.username;
    try {
      const data = await api.get<Profile>(`/api/users/${username}`);
      profile = data;
      if (data.custom_color) {
        const c = data.custom_color;
        // Derive --accent-subtle from the custom hex so badge backgrounds use the right color
        let subtle = 'rgba(224,122,39,0.15)';
        const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
        if (m) subtle = `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},0.15)`;
        customStyle = `--accent:${c};--accent-hover:${c};--accent-subtle:${subtle};`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('suspended')) banned = true;
      else notFound = true;
    } finally {
      loading = false;
    }
  });

  async function submitReport(e: Event) {
    e.preventDefault();
    if (!profile || !reportReason.trim()) return;
    reportLoading = true;
    try {
      await api.post('/api/reports', { reported_username: profile.username, reason: reportReason });
      reportMsg = 'Report submitted. Thank you.';
      reportReason = '';
    } catch (err) {
      reportMsg = err instanceof Error ? err.message : 'Failed to submit report';
    } finally {
      reportLoading = false;
    }
  }
</script>

<svelte:head>
  <title>{profile ? (profile.display_name || '@' + profile.username) : 'Profile'} — pronouns</title>
</svelte:head>

{#if loading}
  <div class="loading">Loading profile…</div>
{:else if banned}
  <div class="container error-page">
    <h2>Account suspended</h2>
    <p>This account has been suspended for violating community guidelines.</p>
    <a href="/" class="btn btn-secondary" style="margin-top:1rem">Go home</a>
  </div>
{:else if notFound || !profile}
  <div class="container error-page">
    <h2>Profile not found</h2>
    <p>This user doesn't exist or their profile is unavailable.</p>
    <a href="/" class="btn btn-secondary" style="margin-top:1rem">Go home</a>
  </div>
{:else}
  <div style={customStyle}>
    <!-- Banner -->
    {#if profile.banner && isVideo(profile.banner)}
      <div class="profile-banner has-image" style="height:{bannerHeightPx}px;position:relative;overflow:hidden">
        <video src={profile.banner} autoplay loop muted playsinline
          style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:{profile.banner_position || '50% 50%'}"></video>
      </div>
    {:else}
      <div
        class="profile-banner"
        class:has-image={!!profile.banner}
        style={profile.banner
          ? `height:${bannerHeightPx}px;background-image:url(${profile.banner});background-position:${profile.banner_position || '50% 50%'}`
          : `height:${bannerHeightPx}px`}
      ></div>
    {/if}

    <!-- Header: avatar row (overlaps banner) + identity row (always on page bg) -->
    <div class="container">
      <!-- Avatar centered over the banner/page boundary -->
      <div class="profile-header" style="margin-top:{-avatarSizePx / 2}px">
        {#if profile.profile_picture}
          {#if isVideo(profile.profile_picture)}
            <video src={profile.profile_picture} autoplay loop muted playsinline
              class="profile-avatar" style="width:{avatarSizePx}px;height:{avatarSizePx}px"></video>
          {:else}
            <img src={profile.profile_picture} alt="" class="profile-avatar"
              style="width:{avatarSizePx}px;height:{avatarSizePx}px" />
          {/if}
        {:else}
          <div class="profile-avatar-placeholder"
            style="width:{avatarSizePx}px;height:{avatarSizePx}px;font-size:{avatarSizePx * 0.4}px">
            <i class="fa-solid fa-user"></i>
          </div>
        {/if}
      </div>

      <!-- Identity: name/username/meta centered below avatar -->
      <div class="profile-identity">
        <div class="profile-name-row">
          <span class="profile-display-name">{profile.display_name || '@' + profile.username}</span>
          {#if profile.display_name}
            <span class="profile-username">@{profile.username}</span>
          {/if}
        </div>
        <div class="profile-meta">
            {#if profile.pronouns}<span><i class="fa-solid fa-tag" style="color:var(--accent)"></i> {profile.pronouns}</span>{/if}
            {#if profile.gender}<span>{profile.gender}</span>{/if}
            {#if profile.occupation}<span><i class="fa-solid fa-briefcase" style="color:var(--accent)"></i> {profile.occupation}</span>{/if}
            {#if profile.location}<span><i class="fa-solid fa-location-dot" style="color:var(--accent)"></i> {profile.location}</span>{/if}
            {#if profile.birthday}<span><i class="fa-solid fa-cake-candles" style="color:var(--accent)"></i> {formatBirthday(profile.birthday)}</span>{/if}
            <span><i class="fa-solid fa-door-open" style="color:var(--accent)"></i> Joined {new Date(profile.created_at).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
        {#if profile.badges.filter(b => b.visible).length > 0}
          <div class="badge-row">
            {#each profile.badges.filter(b => b.visible) as badge}
              <span class="profile-badge" style="--badge-color:{badge.color}" title={badge.description}>
                <i class="{badge.icon}"></i>
                {badge.name}
              </span>
            {/each}
          </div>
        {/if}
        {#if isOwnProfile}
          <a href="/settings/profile" class="btn btn-secondary btn-sm" style="margin-top:0.75rem;display:inline-block">Edit profile</a>
        {/if}
      </div>

      <!-- Section divider -->
      <div class="profile-divider"><span>Info</span></div>

      {#if isOwnProfile && sectionOrder.some(id => sectionVisible(id))}
        <p class="drag-hint"><i class="fa-solid fa-grip-vertical"></i> Drag sections to reorder</p>
      {/if}

      {#each sectionOrder as sid (sid)}
        {#if sectionVisible(sid)}
          {@const isField = sid.startsWith('field:')}
          {@const field = isField ? profile.custom_fields.find(f => `field:${f.id}` === sid) ?? null : null}
          <div
            class="profile-section"
            class:section-dragging={dragId === sid}
            class:section-drop-target={dragOverId === sid && dragId !== sid}
            class:section-draggable={isOwnProfile}
            draggable={isOwnProfile}
            ondragstart={(e) => onDragStart(e, sid)}
            ondragover={(e) => onDragOver(e, sid)}
            ondrop={onDrop}
            ondragend={onDragEnd}
            role="region"
          >
            {#if isOwnProfile}
              <span class="drag-handle" aria-hidden="true"><i class="fa-solid fa-grip-vertical"></i></span>
            {/if}

            {#if sid === 'names'}
              <div class="tag-list">
                {#each profile.names as n}
                  <span class="badge">
                    {#if n.preference === 'favorite'}<i class="fa-solid fa-star" style="color:var(--accent);font-size:10px;margin-right:3px"></i>{/if}
                    {#if n.preference === 'okay'}<i class="fa-solid fa-thumbs-up" style="color:var(--accent);font-size:10px;margin-right:3px"></i>{/if}
                    {n.name}
                  </span>
                {/each}
              </div>

            {:else if sid === 'bio'}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <div class="profile-bio bio-content" onclick={interceptBioLink}>{@html renderMarkdown(profile.bio ?? '')}</div>

            {:else if sid === 'flags'}
              <p class="section-title">Flags</p>
              <div class="flags-grid">
                {#each profile.flags as flag}
                  <div class="flag-card">
                    {#if flag.flag_image.startsWith('css:')}
                      <div class="flag {flag.flag_image.slice(4)}"></div>
                    {:else}
                      <img src={flag.flag_image} alt={flag.flag_name} />
                    {/if}
                    <div class="flag-card-name">{flag.flag_name}</div>
                  </div>
                {/each}
              </div>

            {:else if sid === 'images'}
              <p class="section-title">Images</p>
              <div class="images-grid">
                {#each profile.images as img}
                  <div class="image-card" onclick={() => { lightboxSrc = img.image_url; lightboxCaption = img.caption; }}>
                    <img src={img.image_url} alt={img.caption || ''} />
                    {#if img.caption}<div class="image-card-caption">{img.caption}</div>{/if}
                  </div>
                {/each}
              </div>

            {:else if sid === 'links'}
              <p class="section-title">Links</p>
              {#if profile.links.length > 0}
                <div class="tag-list">
                  {#each profile.links as link}
                    <a href={link.link_url} target="_blank" rel="noopener noreferrer" class="profile-link-btn">
                      {link.link_label} <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                  {/each}
                </div>
              {/if}
              {#if profile.website}
                <div style="margin-top:0.5rem">
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" style="font-size:13px">
                    <i class="fa-solid fa-globe" style="color:var(--accent)"></i> {profile.website}
                  </a>
                </div>
              {/if}
              {#if profile.show_site && profile.site_enabled}
                <div style="margin-top:0.5rem">
                  <a href="{location.origin}/sites/{profile.username}/" target="_blank" rel="noopener noreferrer" style="font-size:13px">
                    <i class="fa-solid fa-earth-americas" style="color:var(--accent)"></i> {profile.username}'s personal site
                  </a>
                </div>
              {/if}

            {:else if sid === 'clock'}
              <p class="section-title"><i class="fa-regular fa-clock" style="color:var(--accent)"></i> Current time</p>
              <div class="clock-display">{currentTime}</div>
              <div class="clock-tz">{profile.timezone!.replace(/_/g, ' ')}</div>

            {:else if sid === 'friends'}
              <p class="section-title">Friends</p>
              <div class="friends-list">
                {#each profile.friends as f}
                  {#if /^[a-zA-Z0-9_-]+$/.test(f.friend_username)}
                    <a href="/@{f.friend_username}" class="badge">@{f.friend_username}</a>
                  {:else}
                    <span class="badge">{f.friend_username}</span>
                  {/if}
                {/each}
              </div>

            {:else if isField && field}
              <p class="section-title">{field.field_name}</p>
              <div class="tag-list">
                {#each field.entries as entry}
                  <span class="badge">
                    {#if entry.preference === 'favorite'}<i class="fa-solid fa-star" style="color:var(--accent);font-size:10px;margin-right:3px"></i>{/if}
                    {#if entry.preference === 'okay'}<i class="fa-solid fa-thumbs-up" style="color:var(--accent);font-size:10px;margin-right:3px"></i>{/if}
                    {entry.value}{#if entry.entry_status}<span style="opacity:0.65;font-size:11px;margin-left:4px">({entry.entry_status})</span>{/if}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      {/each}

      <!-- Actions -->
      {#if !isOwnProfile}
        <div style="margin-top:2rem;padding-bottom:1rem">
          <button class="btn btn-ghost btn-sm" onclick={() => { reportOpen = true; reportMsg = ''; }}>
            Report this profile
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Report modal -->
  <Modal open={reportOpen} title="Report profile" onClose={() => reportOpen = false}>
    {#snippet children()}
      {#if reportMsg}
        <p class={reportMsg.includes('submitted') ? 'msg-success' : 'msg-error'}>{reportMsg}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick={() => reportOpen = false}>Close</button>
        </div>
      {:else}
        <form onsubmit={submitReport}>
          <div class="form-group">
            <label class="form-label" for="report-reason">Reason for report</label>
            <textarea
              id="report-reason"
              bind:value={reportReason}
              placeholder="Describe why you are reporting this profile…"
              required
            ></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" onclick={() => reportOpen = false}>Cancel</button>
            <button type="submit" class="btn btn-danger btn-sm" disabled={reportLoading}>
              {reportLoading ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </form>
      {/if}
    {/snippet}
  </Modal>
{/if}

<!-- Link warning modal -->
<Modal open={linkWarningOpen} title="External Link" onClose={() => { linkWarningOpen = false; pendingLink = ''; }}>
  {#snippet children()}
    <div style="display:flex;flex-direction:column;gap:1rem">
      <div style="display:flex;align-items:flex-start;gap:0.75rem">
        <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:rgba(217,85,85,0.15);display:flex;align-items:center;justify-content:center">
          <i class="fa-solid fa-triangle-exclamation" style="color:var(--danger);font-size:15px"></i>
        </div>
        <div>
          <p style="font-weight:600;margin-bottom:0.25rem">This link may be dangerous</p>
          <p style="font-size:13px;color:var(--text-muted);line-height:1.5">
            Links in user bios are not reviewed by us. Only open links from people you trust.
          </p>
        </div>
      </div>

      <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius);padding:0.65rem 0.75rem">
        <p style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:0.3rem">Destination</p>
        <p style="font-weight:600;font-size:14px;color:var(--text);word-break:break-all;margin-bottom:0.2rem">{linkDomain(pendingLink)}</p>
        <p style="font-size:11px;color:var(--text-muted);word-break:break-all;font-family:monospace">{pendingLink}</p>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" onclick={() => { linkWarningOpen = false; pendingLink = ''; }}>Cancel</button>
        <button class="btn btn-primary" onclick={openPendingLink}>
          Open <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px"></i>
        </button>
      </div>
    </div>
  {/snippet}
</Modal>

<!-- Lightbox -->
{#if lightboxSrc}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="lightbox" onclick={() => { lightboxSrc = null; lightboxCaption = null; }}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
    <img src={lightboxSrc} alt={lightboxCaption || ''} onclick={(e) => e.stopPropagation()} />
    {#if lightboxCaption}
      <div class="lightbox-caption">{lightboxCaption}</div>
    {/if}
  </div>
  <button class="lightbox-close" onclick={() => { lightboxSrc = null; lightboxCaption = null; }} aria-label="Close">×</button>
{/if}
