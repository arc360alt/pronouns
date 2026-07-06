<script lang="ts">
  import { user, theme } from '$lib/stores';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import NotificationBell from '$lib/components/NotificationBell.svelte';

  let menuOpen = $state(false);

  $effect(() => {
    // close menu on navigation
    $page.url.pathname;
    menuOpen = false;
  });

  function toggleTheme() {
    const next = $theme === 'dark' ? 'light' : 'dark';
    theme.set(next);
    if (typeof localStorage !== 'undefined') localStorage.setItem('theme', next);
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', next);
  }

  function logout() {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('token');
    user.set(null);
    menuOpen = false;
    goto('/');
  }
</script>

<nav class="navbar">
  <div class="container navbar-inner">
    <a href="/" class="brand">
      <img src="/logo.svg" alt="" class="brand-logo" onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <span>pronouns</span>
    </a>

    <!-- Desktop nav -->
    <div class="nav-links nav-links-desktop">
      {#if $user}
        <a href="/@{$user.username}"><i class="fa-solid fa-circle-user"></i> @{$user.username}</a>
        <a href="/settings/profile"><i class="fa-solid fa-pen"></i> Edit Profile</a>
        <a href="/settings"><i class="fa-solid fa-gear"></i> Settings</a>
        <a href="/feedback"><i class="fa-solid fa-comment-dots"></i> Feedback</a>
        {#if $user.is_admin}
          <a href="/admin"><i class="fa-solid fa-shield-halved"></i> Admin</a>
        {/if}
      {/if}
      {#if $user}<NotificationBell />{/if}
      <button class="btn-theme" onclick={toggleTheme}>
        {#if $theme === 'dark'}
          <i class="fa-solid fa-sun"></i> Light mode
        {:else}
          <i class="fa-solid fa-moon"></i> Dark mode
        {/if}
      </button>
      {#if $user}
        <button class="btn btn-secondary btn-sm" onclick={logout}><i class="fa-solid fa-right-from-bracket"></i> Log out</button>
      {:else}
        <a href="/login" class="btn btn-secondary btn-sm"><i class="fa-solid fa-right-to-bracket"></i> Log in</a>
        <a href="/register" class="btn btn-primary btn-sm" style="color:#fff"><i class="fa-solid fa-user-plus"></i> Register</a>
      {/if}
    </div>

    <!-- Mobile hamburger -->
    <button class="nav-hamburger" onclick={() => menuOpen = !menuOpen} aria-label="Menu">
      <i class="fa-solid {menuOpen ? 'fa-xmark' : 'fa-bars'}"></i>
    </button>
  </div>
</nav>

<!-- Mobile drawer -->
{#if menuOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="nav-drawer-overlay" onclick={() => menuOpen = false}></div>
  <div class="nav-drawer">
    {#if $user}
      <a href="/@{$user.username}"><i class="fa-solid fa-circle-user"></i> @{$user.username}</a>
      <a href="/settings/profile"><i class="fa-solid fa-pen"></i> Edit Profile</a>
      <a href="/settings/site"><i class="fa-solid fa-globe"></i> My Site</a>
      <a href="/settings"><i class="fa-solid fa-gear"></i> Settings</a>
      <a href="/feedback"><i class="fa-solid fa-comment-dots"></i> Feedback</a>
      {#if $user.is_admin}
        <a href="/admin"><i class="fa-solid fa-shield-halved"></i> Admin</a>
      {/if}
      <div class="nav-drawer-divider"></div>
    {/if}
    <button class="nav-drawer-item btn-theme" onclick={toggleTheme}>
      {#if $theme === 'dark'}
        <i class="fa-solid fa-sun"></i> Light mode
      {:else}
        <i class="fa-solid fa-moon"></i> Dark mode
      {/if}
    </button>
    {#if $user}
      <button class="nav-drawer-item btn-danger-ghost" onclick={logout}><i class="fa-solid fa-right-from-bracket"></i> Log out</button>
    {:else}
      <div class="nav-drawer-divider"></div>
      <a href="/login"><i class="fa-solid fa-right-to-bracket"></i> Log in</a>
      <a href="/register" style="color:var(--accent)"><i class="fa-solid fa-user-plus"></i> Register</a>
    {/if}
  </div>
{/if}
