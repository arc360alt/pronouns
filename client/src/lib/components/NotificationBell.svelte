<script lang="ts">
  import { notifUnread } from '$lib/stores';
</script>

<a href="/notifications" class="notif-link" aria-label="Notifications">
  <i class="fa-solid fa-bell"></i>
  {#if $notifUnread > 0}
    <span class="notif-count">{$notifUnread > 99 ? '99+' : $notifUnread}</span>
  {/if}
</a>

<style>
  .notif-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    color: var(--text-muted);
    font-size: 14px;
    text-decoration: none;
    padding: 0.1rem 0.15rem;
  }
  .notif-link:hover { color: var(--text); }
  .notif-count {
    position: absolute;
    top: -5px;
    right: -7px;
    background: var(--accent);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    min-width: 16px;
    height: 16px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
    line-height: 1;
  }
</style>
