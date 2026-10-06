<script lang="ts">
  import { notifUnread } from '$lib/stores';
  import { page } from '$app/stores';
</script>

<a href="/notifications" class="nav-icon-btn" class:active={$page.url.pathname === '/notifications'} aria-label="Notifications" title="Notifications">
  <i class="fa-solid fa-bell"></i>
  {#if $notifUnread > 0}
    <span class="nav-icon-badge">{$notifUnread > 99 ? '99+' : $notifUnread}</span>
  {/if}
</a>
