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
    font-size: 0.95rem;
    text-decoration: none;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.35rem 0.55rem;
    transition: color 0.15s, border-color 0.15s;
  }
  .notif-link:hover { color: var(--text); border-color: var(--text-muted); text-decoration: none; }
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
