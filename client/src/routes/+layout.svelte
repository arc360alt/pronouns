<script lang="ts">
  import '../app.css';
  import Navbar from '$lib/components/Navbar.svelte';
  import SiteBanner from '$lib/components/SiteBanner.svelte';
  import { user, theme, userReady, notifUnread } from '$lib/stores';
  import { loadSavedAccent } from '$lib/accent';
  import { onMount, onDestroy } from 'svelte';
  import { api } from '$lib/api';
  import type { Snippet } from 'svelte';
  import type { User } from '$lib/types';

  interface Props { children: Snippet; }
  let { children }: Props = $props();

  let memberCount = $state<number | null>(null);
  let banner = $state<{ text: string; color: string; btn_text: string | null; btn_url: string | null } | null>(null);
  let bannerDismissed = $state(false);
  let notifTimer: ReturnType<typeof setInterval> | null = null;

  async function pollNotifCount() {
    try {
      const { count } = await api.get<{ count: number }>('/api/notifications/unread-count');
      notifUnread.set(count);
    } catch {}
  }

  onMount(async () => {
    const saved = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
    theme.set(saved);
    document.documentElement.setAttribute('data-theme', saved);
    loadSavedAccent();

    try { bannerDismissed = sessionStorage.getItem('banner_dismissed') === '1'; } catch {}

    const token = localStorage.getItem('token');
    if (token) {
      try {
        const me = await api.get<User>('/api/auth/me');
        user.set(me);
        pollNotifCount();
        notifTimer = setInterval(pollNotifCount, 60_000);
      } catch {
        localStorage.removeItem('token');
      }
    }
    userReady.set(true);

    try {
      const [stats, b] = await Promise.all([
        api.get<{ member_count: number }>('/api/site/stats'),
        api.get<typeof banner>('/api/site/banner'),
      ]);
      memberCount = stats.member_count;
      if (!bannerDismissed) banner = b;
    } catch {}
  });

  onDestroy(() => { if (notifTimer) clearInterval(notifTimer); });
</script>

{#if banner}
  <SiteBanner text={banner.text} color={banner.color} btn_text={banner.btn_text} btn_url={banner.btn_url} />
{/if}
<Navbar />
<main class="main-content">
  {@render children()}
</main>

<footer class="footer">
  <div class="container">
    pronouns · an app by nyx · <a href="https://nyxdev.app/gh/pronouns" target="_blank" rel="noopener">Github</a>
    {#if memberCount !== null}
       |  <strong>{memberCount.toLocaleString()}</strong> {memberCount === 1 ? 'member' : 'members'}
    {/if}
  </div>
</footer>
