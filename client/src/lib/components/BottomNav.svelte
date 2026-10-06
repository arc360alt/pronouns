<script lang="ts">
  import { user, theme, notifUnread, dmUnread, dmsEnabled, forcedTheme } from '$lib/stores';
  import { page } from '$app/stores';
  import { toggleTheme, logout, isActivePath } from '$lib/navActions';

  interface NavItem {
    href: string;
    label: string;
    icon: string;
    exact?: boolean;
    badge?: number;
  }

  // Width each destination needs on the bar (M3 spec is 64–80dp per item)
  const ITEM_WIDTH = 76;
  const MAX_SLOTS = 5;

  let innerWidth = $state(0);
  let sheetOpen = $state(false);

  $effect(() => {
    // close the sheet on navigation
    $page.url.pathname;
    sheetOpen = false;
  });

  let items = $derived.by<NavItem[]>(() => {
    const u = $user;
    if (!u) {
      return [
        { href: '/', label: 'Home', icon: 'fa-house', exact: true },
        { href: '/login', label: 'Log in', icon: 'fa-right-to-bracket' },
        { href: '/register', label: 'Register', icon: 'fa-user-plus' },
      ];
    }
    const list: NavItem[] = [
      { href: '/@' + u.username, label: 'Profile', icon: 'fa-circle-user' },
      { href: '/notifications', label: 'Alerts', icon: 'fa-bell', badge: $notifUnread },
    ];
    if ($dmsEnabled) list.push({ href: '/dms', label: 'Messages', icon: 'fa-message', badge: $dmUnread });
    list.push(
      { href: '/settings/profile', label: 'Edit', icon: 'fa-pen' },
      { href: '/settings', label: 'Settings', icon: 'fa-gear', exact: true },
      { href: '/settings/site', label: 'My Site', icon: 'fa-globe' },
      { href: '/feedback', label: 'Feedback', icon: 'fa-comment-dots' },
    );
    if (u.is_admin) list.push({ href: '/admin', label: 'Admin', icon: 'fa-shield-halved' });
    return list;
  });

  // One slot is always reserved for "More" (theme + log out live there)
  let slots = $derived(Math.max(3, Math.min(MAX_SLOTS, Math.floor((innerWidth || 360) / ITEM_WIDTH))));
  let visible = $derived(items.slice(0, slots - 1));
  let overflow = $derived(items.slice(slots - 1));
  let overflowBadge = $derived(overflow.some(i => (i.badge ?? 0) > 0));
  let overflowActive = $derived(overflow.some(i => active(i)));

  function active(i: NavItem) {
    return isActivePath($page.url.pathname, i.href, i.exact);
  }

  const fmt = (n: number) => (n > 99 ? '99+' : String(n));
</script>

<svelte:window bind:innerWidth onkeydown={(e) => { if (e.key === 'Escape') sheetOpen = false; }} />

<nav class="bottom-nav" aria-label="Main">
  {#each visible as item (item.href)}
    <a href={item.href} class="bn-item" class:active={active(item)} aria-current={active(item) ? 'page' : undefined}>
      <span class="bn-indicator" data-ripple>
        <i class="fa-solid {item.icon}"></i>
        {#if item.badge}<span class="bn-badge">{fmt(item.badge)}</span>{/if}
      </span>
      <span class="bn-label">{item.label}</span>
    </a>
  {/each}
  <button class="bn-item" class:active={sheetOpen || overflowActive} data-no-ripple
    aria-haspopup="dialog" aria-expanded={sheetOpen} onclick={() => sheetOpen = !sheetOpen}>
    <span class="bn-indicator" data-ripple>
      <i class="fa-solid fa-ellipsis"></i>
      {#if overflowBadge}<span class="bn-badge bn-badge-dot"></span>{/if}
    </span>
    <span class="bn-label">More</span>
  </button>
</nav>

{#if sheetOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="sheet-scrim" onclick={() => sheetOpen = false}></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="More options">
    <div class="sheet-handle" aria-hidden="true"></div>

    {#if overflow.length}
      <div class="sheet-grid">
        {#each overflow as item (item.href)}
          <a href={item.href} class="sheet-tile" class:active={active(item)} data-ripple>
            <span class="sheet-tile-icon">
              <i class="fa-solid {item.icon}"></i>
              {#if item.badge}<span class="bn-badge">{fmt(item.badge)}</span>{/if}
            </span>
            <span class="sheet-tile-label">{item.label}</span>
          </a>
        {/each}
      </div>
      <md-divider style="margin:0.5rem 0"></md-divider>
    {/if}

    <button class="sheet-row" onclick={toggleTheme} disabled={!!$forcedTheme}>
      {#if $forcedTheme}
        <i class="fa-solid fa-lock"></i> Theme locked by this profile
      {:else if $theme === 'dark'}
        <i class="fa-solid fa-sun"></i> Light mode
      {:else}
        <i class="fa-solid fa-moon"></i> Dark mode
      {/if}
    </button>
    {#if $user}
      <button class="sheet-row sheet-row-danger" onclick={() => { sheetOpen = false; logout(); }}>
        <i class="fa-solid fa-right-from-bracket"></i> Log out
      </button>
    {/if}
  </div>
{/if}

<style>
  .bottom-nav {
    display: none;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 250;
    height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px));
    padding: 12px 0 calc(16px + env(safe-area-inset-bottom, 0px));
    background: var(--md-sys-color-surface-container);
    box-shadow: var(--md-elev-2);
  }
  @media (max-width: 880px) {
    .bottom-nav { display: flex; }
  }

  .bn-item {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    padding: 0;
    min-height: 0;
    background: none;
    border: none;
    border-radius: 0;
    color: var(--md-sys-color-on-surface-variant);
    text-decoration: none;
    font-family: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .bn-item:hover { text-decoration: none; }

  /* M3 active indicator: 64×32 pill */
  .bn-indicator {
    position: relative;
    width: 64px;
    height: 32px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    transition: background-color 0.2s var(--md-motion-standard);
  }
  .bn-indicator > i { line-height: 1; }
  .bn-item.active .bn-indicator {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
    animation: bn-pop 0.3s var(--md-motion-emphasized-decelerate);
  }
  @keyframes bn-pop { from { transform: scaleX(0.4); opacity: 0.4; } to { transform: none; opacity: 1; } }

  .bn-label {
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
    letter-spacing: 0.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .bn-item.active .bn-label { color: var(--md-sys-color-on-surface); font-weight: 700; }

  /* M3 badges */
  .bn-badge {
    position: absolute;
    top: 0;
    left: 36px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--md-sys-color-error);
    color: var(--md-sys-color-on-error);
    font-size: 11px;
    font-weight: 500;
    line-height: 16px;
    text-align: center;
    pointer-events: none;
  }
  .bn-badge-dot { min-width: 6px; width: 6px; height: 6px; padding: 0; top: 4px; left: 40px; }

  /* M3 modal bottom sheet */
  .sheet-scrim {
    position: fixed;
    inset: 0;
    z-index: 260;
    background: color-mix(in srgb, var(--md-sys-color-scrim) 32%, transparent);
    animation: sheet-fade 0.2s var(--md-motion-standard);
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 270;
    max-height: 80vh;
    overflow-y: auto;
    margin: 0 auto;
    max-width: 640px;
    padding: 0 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
    background: var(--md-sys-color-surface-container-low);
    color: var(--md-sys-color-on-surface);
    border-radius: 28px 28px 0 0;
    box-shadow: var(--md-elev-1);
    animation: sheet-up 0.35s var(--md-motion-emphasized-decelerate);
  }
  .sheet-handle {
    width: 32px;
    height: 4px;
    border-radius: 2px;
    background: var(--md-sys-color-on-surface-variant);
    opacity: 0.4;
    margin: 22px auto 18px;
  }
  @keyframes sheet-up { from { transform: translateY(100%); } to { transform: none; } }
  @keyframes sheet-fade { from { opacity: 0; } to { opacity: 1; } }

  .sheet-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 0.25rem;
    padding-bottom: 0.5rem;
  }
  .sheet-tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 0.25rem;
    border-radius: var(--md-sys-shape-corner-large);
    color: var(--md-sys-color-on-surface);
    text-decoration: none;
  }
  .sheet-tile:hover { text-decoration: none; }
  .sheet-tile-icon {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: var(--md-sys-shape-corner-large);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    background: var(--md-sys-color-surface-container-highest);
    color: var(--md-sys-color-on-surface-variant);
  }
  .sheet-tile-icon .bn-badge { left: auto; right: -2px; top: -2px; }
  .sheet-tile.active .sheet-tile-icon {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
  }
  .sheet-tile-label { font-size: 12px; font-weight: 500; letter-spacing: 0.5px; text-align: center; }

  .sheet-row {
    width: 100%;
    justify-content: flex-start;
    gap: 1rem;
    min-height: 56px;
    padding: 0 1rem;
    border-radius: var(--md-sys-shape-corner-full);
    color: var(--md-sys-color-on-surface);
    font-size: 15px;
    font-weight: 500;
  }
  .sheet-row i { width: 24px; font-size: 18px; color: var(--md-sys-color-on-surface-variant); }
  .sheet-row-danger, .sheet-row-danger i { color: var(--md-sys-color-error); }
</style>
