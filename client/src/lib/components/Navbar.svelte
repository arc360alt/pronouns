<script lang="ts">
  import { user, theme, notifUnread, forcedTheme } from '$lib/stores';
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
    // Don't touch data-theme while a profile's forced theme is active
    if (!$forcedTheme && typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
    }
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
      <svg class="brand-logo" width="26" height="26" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M30.5273 28.6142C31.3056 26.2188 34.6944 26.2188 35.4727 28.6142L39.8252 42.0098C40.1733 43.081 41.1716 43.8063 42.298 43.8063H56.3829C58.9016 43.8063 59.9488 47.0293 57.9111 48.5098L46.5162 56.7887C45.6049 57.4508 45.2236 58.6243 45.5717 59.6956L49.9242 73.0911C50.7025 75.4865 47.9608 77.4785 45.9232 75.998L34.5282 67.7191C33.617 67.057 32.383 67.057 31.4718 67.7191L20.0768 75.998C18.0392 77.4785 15.2975 75.4865 16.0758 73.0911L20.4283 59.6956C20.7764 58.6243 20.3951 57.4508 19.4838 56.7887L8.08887 48.5098C6.05122 47.0293 7.09843 43.8063 9.61711 43.8063H23.702C24.8284 43.8063 25.8267 43.081 26.1748 42.0098L30.5273 28.6142Z" fill="var(--accent)"/>
        <path d="M56.5549 19.7578C55.7313 17.3776 58.4346 15.3339 60.5 16.7754L64.4372 19.5233C65.3609 20.1679 66.5946 20.1445 67.4932 19.4652L71.3232 16.5698C73.3324 15.051 76.1114 16.9905 75.3787 19.4002L73.982 23.9939C73.6543 25.0716 74.0579 26.2377 74.9815 26.8823L78.9188 29.6302C80.9842 31.0717 79.9984 34.314 77.4801 34.3618L72.6797 34.453C71.5535 34.4744 70.5692 35.2185 70.2415 36.2962L68.8448 40.8899C68.1121 43.2997 64.7238 43.364 63.9002 40.9838L62.33 36.4465C61.9617 35.382 60.9498 34.6758 59.8236 34.6972L55.0232 34.7884C52.5049 34.8362 51.3967 31.6337 53.4059 30.1148L57.2359 27.2194C58.1345 26.5401 58.4934 25.3595 58.1251 24.2951L56.5549 19.7578Z" fill="#a87ce8"/>
        <path d="M56.2693 71.8623C54.062 70.6492 54.6966 67.3203 57.1954 67.0043L64.3797 66.0958C65.4972 65.9545 66.3966 65.1097 66.6075 64.0033L67.9636 56.8899C68.4353 54.4157 71.7974 53.9906 72.87 56.2694L75.9541 62.8214C76.4338 63.8405 77.5152 64.4348 78.6327 64.2935L85.817 63.3851C88.3158 63.0691 89.7591 66.1353 87.9232 67.8596L82.645 72.8174C81.824 73.5886 81.5929 74.8007 82.0726 75.8198L85.1567 82.3718C86.2294 84.6506 83.7593 86.9708 81.552 85.7576L75.2058 82.2698C74.2187 81.7273 72.9945 81.8821 72.1734 82.6532L66.8952 87.611C65.0594 89.3354 62.0895 87.7031 62.5612 85.229L63.9172 78.1156C64.1282 77.0091 63.6026 75.8927 62.6155 75.3502L56.2693 71.8623Z" fill="#f4729b"/>
      </svg>
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
      <button class="btn-theme" onclick={toggleTheme} disabled={!!$forcedTheme}
        title={$forcedTheme ? 'Theme locked by this profile' : undefined}>
        {#if $forcedTheme}
          <i class="fa-solid fa-lock"></i> Theme locked
        {:else if $theme === 'dark'}
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
      <a href="/notifications" style="display:flex;align-items:center;gap:0.5rem">
        <i class="fa-solid fa-bell"></i> Notifications
        {#if $notifUnread > 0}<span style="background:var(--accent);color:#fff;border-radius:999px;padding:0 6px;font-size:11px;font-weight:700">{$notifUnread > 99 ? '99+' : $notifUnread}</span>{/if}
      </a>
      {#if $user.is_admin}
        <a href="/admin"><i class="fa-solid fa-shield-halved"></i> Admin</a>
      {/if}
      <div class="nav-drawer-divider"></div>
    {/if}
    <button class="nav-drawer-item" onclick={toggleTheme} disabled={!!$forcedTheme}
      title={$forcedTheme ? 'Theme locked by this profile' : undefined}>
      {#if $forcedTheme}
        <i class="fa-solid fa-lock"></i> Theme locked
      {:else if $theme === 'dark'}
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
