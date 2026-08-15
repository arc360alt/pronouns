<script lang="ts">
  import { page } from '$app/stores';
  import { onDestroy } from 'svelte';
  import { user, theme, forcedTheme as forcedThemeStore } from '$lib/stores';
  import { get } from 'svelte/store';
  import { api } from '$lib/api';
  import Modal from '$lib/components/Modal.svelte';
  import PixLoader from '$lib/components/PixLoader.svelte';
  import type { Profile } from '$lib/types';
  import { renderMarkdown } from '$lib/markdown';

  const isVideo = (url?: string | null) => !!(url && url.toLowerCase().endsWith('.mp4'));

  function sectionLabel(sid: string, fallback: string): string {
    if (!profile?.section_labels) return fallback;
    try {
      const labels = JSON.parse(profile.section_labels) as Record<string, string>;
      return labels[sid]?.trim() || fallback;
    } catch { return fallback; }
  }

  function extractYouTubeId(url: string): string | null {
    if (!url) return null;
    const m = /(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/.exec(url);
    return m ? m[1] : null;
  }

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

  let likeCount = $state(0);
  let likedByMe = $state(false);
  let likeLoading = $state(false);

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
      let m: number, day: number, y: number;
      if (raw.includes('/')) {
        const parts = raw.split('/');
        m = parseInt(parts[0]); day = parseInt(parts[1]); y = parseInt(parts[2]);
      } else {
        const parts = raw.split('-');
        y = parseInt(parts[0]); m = parseInt(parts[1]); day = parseInt(parts[2]);
      }
      if (isNaN(m) || isNaN(day) || isNaN(y)) return raw;
      const d = new Date(Date.UTC(y, m - 1, day));
      const month = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(d);
      return `${month} ${ordinal(day)}, ${y}`;
    } catch { return raw; }
  }

  let isOwnProfile = $derived(
    !!$user && profile ? $user.username.toLowerCase() === profile.username.toLowerCase() : false
  );

  let bannerHeightPx = $derived(Math.min(400, Math.max(100, profile?.banner_height ?? 240)));
  let avatarSizePx = $derived(Math.min(180, Math.max(60, profile?.avatar_size ?? 120)));
  let bgActive = $derived(!!(profile?.profile_bg && profile.profile_bg_type && profile.profile_bg_type !== 'none'));
  let hideBanner = $derived(bgActive && !!profile?.hide_banner_with_bg);

  let hadForcedTheme = false;

  onDestroy(() => {
    if (hadForcedTheme && typeof document !== 'undefined') {
      // Restore to whatever the user's actual preference currently is
      document.documentElement.setAttribute('data-theme', get(theme));
      forcedThemeStore.set(null);
    }
  });

  function hexLum(hex: string): number | null {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return null;
    const lin = (x: number) => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(parseInt(m[1], 16) / 255)
         + 0.7152 * lin(parseInt(m[2], 16) / 255)
         + 0.0722 * lin(parseInt(m[3], 16) / 255);
  }

  function bgTextContrast(data: Profile): string {
    if (!data.profile_bg || data.profile_bg_type === 'none') return '';

    const brightness = data.profile_bg_brightness ?? 0.5;
    // Effective card opacity: use stored value, or CSS defaults (30% for blur, 93% otherwise)
    const cardOpacity = data.section_bg_opacity != null
      ? data.section_bg_opacity / 100
      : (data.section_blur ? 0.30 : 0.93);

    // Background luminance before overlay
    let bgLum: number;
    if (data.profile_bg_type === 'color') {
      bgLum = hexLum(data.profile_bg) ?? 0.05;
    } else if (data.profile_bg_type === 'gradient') {
      const firstHex = /#([0-9a-f]{6})/i.exec(data.profile_bg);
      bgLum = firstHex ? (hexLum('#' + firstHex[1]) ?? 0.05) : 0.05;
    } else {
      // Image / video / youtube: assume average mid-bright photo luminance
      bgLum = 0.4;
    }

    // Apply dark overlay (brightness slider)
    bgLum *= brightness;

    // Card color contribution to what the eye actually sees
    const cardLum = data.section_bg_color ? (hexLum(data.section_bg_color) ?? 0.05) : 0.05;
    const effectiveLum = bgLum * (1 - cardOpacity) + cardLum * cardOpacity;

    if (effectiveLum > 0.18) {
      // Light background showing through → force dark text for readability
      return '--text:#111111;--text-muted:rgba(20,20,20,0.72);--border:rgba(0,0,0,0.14);';
    }
    // Dark background → theme's default light text is already fine
    return '';
  }

  async function loadProfile(username: string) {
    // Reset state for new profile
    profile = null;
    loading = true;
    notFound = false;
    banned = false;
    likeCount = 0;
    likedByMe = false;
    customStyle = '';
    // Restore theme before loading new profile in case previous had forced_theme
    if (hadForcedTheme && typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', get(theme));
      forcedThemeStore.set(null);
      hadForcedTheme = false;
    }
    try {
      const data = await api.get<Profile>(`/api/users/${username}`);
      profile = data;
      if (data.forced_theme && typeof document !== 'undefined') {
        hadForcedTheme = true;
        document.documentElement.setAttribute('data-theme', data.forced_theme);
        forcedThemeStore.set(data.forced_theme as 'dark' | 'light');
      }
      if (data.custom_color) {
        const c = data.custom_color;
        let subtle = 'rgba(224,122,39,0.15)';
        const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
        if (m) subtle = `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},0.15)`;
        const accentBg = data.custom_color_2
          ? `linear-gradient(${data.custom_color_dir || '135deg'}, ${c}, ${data.custom_color_2})`
          : c;
        customStyle = `--accent:${c};--accent-hover:${c};--accent-subtle:${subtle};--accent-bg:${accentBg};`;
      }
      customStyle += bgTextContrast(data);
      try {
        const likes = await api.get<{ count: number; liked_by_me: boolean }>(`/api/users/${username}/likes`);
        likeCount = likes.count;
        likedByMe = likes.liked_by_me;
      } catch { /* non-critical */ }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('suspended')) banned = true;
      else notFound = true;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadProfile($page.params.username);
  });

  async function toggleLike() {
    if (!profile || likeLoading) return;
    likeLoading = true;
    try {
      const res = await api.post<{ liked: boolean; count: number }>(`/api/users/${profile.username}/like`, {});
      likedByMe = res.liked;
      likeCount = res.count;
    } catch { /* ignore */ } finally {
      likeLoading = false;
    }
  }

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
  {#if profile}
    {@const ogTitle = `${profile.display_name || '@' + profile.username} — pronouns`}
    {@const ogDesc = profile.bio ? profile.bio.replace(/[#*_`\[\]()]/g, '').replace(/\n+/g, ' ').trim().slice(0, 200) : `${profile.display_name || '@' + profile.username}'s pronouns profile`}
    <title>{ogTitle}</title>
    <meta property="og:title" content={ogTitle} />
    <meta property="og:description" content={ogDesc} />
    <meta property="og:type" content="profile" />
    <meta property="og:url" content={$page.url.href} />
    {#if profile.profile_picture}
      <meta property="og:image" content={profile.profile_picture.startsWith('http') ? profile.profile_picture : `https://pronouns.sbs${profile.profile_picture}`} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:image" content={profile.profile_picture.startsWith('http') ? profile.profile_picture : `https://pronouns.sbs${profile.profile_picture}`} />
    {/if}
    <meta name="twitter:title" content={ogTitle} />
    <meta name="twitter:description" content={ogDesc} />
  {:else}
    <title>Profile — pronouns</title>
  {/if}
</svelte:head>

{#if loading}
  <div class="loading"><PixLoader size={48} /></div>
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
  <div
    class={[
      profile.profile_bg_type && profile.profile_bg_type !== 'none' ? 'has-profile-bg' : '',
      profile.section_blur && profile.profile_bg_type !== 'none' ? 'has-section-blur' : '',
      profile.content_align === 'left' ? 'profile-align-left' : profile.content_align === 'center' ? 'profile-align-center' : '',
    ].join(' ')}
    style={[
      customStyle,
      profile.section_blur && profile.profile_bg_type !== 'none' ? `--section-blur:${profile.section_blur_amount ?? 8}px;` : '',
      profile.profile_bg_type !== 'none' && profile.section_bg_opacity != null ? `--section-card-alpha:${Math.round(profile.section_bg_opacity)}%;` : '',
      profile.profile_bg_type !== 'none' && profile.section_bg_color ? `--section-card-color:${profile.section_bg_color};` : '',
    ].join('')}
  >
    <!-- Profile background layer -->
    {#if profile.profile_bg && profile.profile_bg_type !== 'none'}
      {@const brightness = profile.profile_bg_brightness ?? 0.5}
      <div class="profile-bg-root">
        {#if profile.profile_bg_type === 'video'}
          <video src={profile.profile_bg} autoplay loop muted playsinline class="profile-bg-fill"></video>
        {:else if profile.profile_bg_type === 'youtube'}
          {@const ytId = extractYouTubeId(profile.profile_bg)}
          {#if ytId}
            <div class="profile-bg-fill" style="overflow:hidden">
              <iframe
                src="https://www.youtube.com/embed/{ytId}?autoplay=1&mute=1&loop=1&playlist={ytId}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3"
                class="profile-bg-youtube-iframe"
                allow="autoplay"
                title=""
              ></iframe>
            </div>
          {/if}
        {:else if profile.profile_bg_type === 'image'}
          <div class="profile-bg-fill" style="background-image:url({profile.profile_bg})"></div>
        {:else if profile.profile_bg_type === 'color' || profile.profile_bg_type === 'gradient'}
          <div class="profile-bg-fill" style="background:{profile.profile_bg}"></div>
        {/if}
        <div class="profile-bg-overlay" style="opacity:{1 - brightness}"></div>
      </div>
    {/if}
    <div class="profile-content-scroll">
    <!-- Banner — hidden when user has a background set and chose to merge -->
    {#if !hideBanner}
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
    {/if}

    <!-- Header: avatar row + identity row -->
    <div class="container">
      <!-- When banner is hidden, pad from top instead of overlapping the banner -->
      <div class="profile-header" style="margin-top:{hideBanner ? '2.5rem' : -avatarSizePx / 2 + 'px'};{hideBanner ? 'margin-bottom:1.25rem' : ''}">
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
            {#if profile.pronouns}<span><i class="fa-solid fa-tag accent-icon"></i> {profile.pronouns}</span>{/if}
            {#if profile.gender}<span>{profile.gender}</span>{/if}
            {#if profile.occupation}<span><i class="fa-solid fa-briefcase accent-icon"></i> {profile.occupation}</span>{/if}
            {#if profile.location}<span><i class="fa-solid fa-location-dot accent-icon"></i> {profile.location}</span>{/if}
            {#if profile.birthday}<span><i class="fa-solid fa-cake-candles accent-icon"></i> {formatBirthday(profile.birthday)}</span>{/if}
            <span><i class="fa-solid fa-door-open accent-icon"></i> Joined {new Date(profile.created_at).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
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
        <div class="profile-like-row">
          {#if isOwnProfile}
            <a href="/settings/profile" class="btn btn-secondary btn-sm">Edit profile</a>
          {:else}
            <button
              class="profile-like-btn {likedByMe ? 'liked' : ''}"
              onclick={toggleLike}
              disabled={likeLoading || !$user}
              title={$user ? (likedByMe ? 'Unlike profile' : 'Like profile') : 'Log in to like profiles'}
            >
              <i class="fa-{likedByMe ? 'solid' : 'regular'} fa-heart"></i>
              {likeCount}
            </button>
          {/if}
        </div>
      </div>

      <!-- Section divider -->
      <div class="profile-divider"><span>{sectionLabel('info', 'Info')}</span></div>

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
              {#if sectionLabel('names', '')}
                <p class="section-title">{sectionLabel('names', '')}</p>
              {/if}
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
              {#if sectionLabel('bio', '')}
                <p class="section-title">{sectionLabel('bio', '')}</p>
              {/if}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <div class="profile-bio bio-content" onclick={interceptBioLink}>{@html renderMarkdown(profile.bio ?? '')}</div>

            {:else if sid === 'flags'}
              <p class="section-title">{sectionLabel('flags', 'Flags')}</p>
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
              <p class="section-title">{sectionLabel('images', 'Images')}</p>
              <div class="images-grid">
                {#each profile.images as img}
                  <div class="image-card" onclick={() => { lightboxSrc = img.image_url; lightboxCaption = img.caption; }}>
                    <img src={img.image_url} alt={img.caption || ''} />
                    {#if img.caption}<div class="image-card-caption">{img.caption}</div>{/if}
                  </div>
                {/each}
              </div>

            {:else if sid === 'links'}
              <p class="section-title">{sectionLabel('links', 'Links')}</p>
              {#if profile.links.length > 0}
                <div class="tag-list">
                  {#each profile.links as link}
                    <a href={link.link_url} target="_blank" rel="noopener noreferrer" class="profile-link-btn" aria-label={link.link_label}>
                      <span class="link-inner">
                        {#if link.link_icon_mode === 'icon' && link.link_icon}
                          <i class={link.link_icon} style="font-size:{link.link_icon_size ?? 1.5}em"></i>
                        {:else if link.link_icon_mode === 'both' && link.link_icon}
                          <i class={link.link_icon} style="font-size:{link.link_icon_size ?? 1.5}em"></i>{link.link_label}
                        {:else}
                          {link.link_label} <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        {/if}
                      </span>
                    </a>
                  {/each}
                </div>
              {/if}
              {#if profile.website}
                <div style="margin-top:0.5rem">
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" style="font-size:13px">
                    <i class="fa-solid fa-globe accent-icon"></i> {profile.website}
                  </a>
                </div>
              {/if}
              {#if profile.show_site && profile.site_enabled}
                <div style="margin-top:0.5rem">
                  <a href="{location.origin}/sites/{profile.username}/" target="_blank" rel="noopener noreferrer" style="font-size:13px">
                    <i class="fa-solid fa-earth-americas accent-icon"></i> {profile.username}'s personal site
                  </a>
                </div>
              {/if}

            {:else if sid === 'clock'}
              <p class="section-title"><i class="fa-regular fa-clock accent-icon"></i> {sectionLabel('clock', 'Current time')}</p>
              <div class="clock-display">{currentTime}</div>
              <div class="clock-tz">{profile.timezone!.replace(/_/g, ' ')}</div>

            {:else if sid === 'friends'}
              <p class="section-title">{sectionLabel('friends', 'Friends')}</p>
              <div class="friends-list">
                {#each profile.friends as f}
                  {@const uname = f.friend_username.replace(/^@/, '')}
                  {#if /^[a-zA-Z0-9_-]+$/.test(uname)}
                    <a href="/@{uname}" class="badge">@{uname}</a>
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
