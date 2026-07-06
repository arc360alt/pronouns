<script lang="ts">
  interface Props {
    text: string;
    color: string;
    btn_text?: string | null;
    btn_url?: string | null;
  }
  let { text, color, btn_text, btn_url }: Props = $props();
  let dismissed = $state(false);

  function dismiss() {
    dismissed = true;
    try { sessionStorage.setItem('banner_dismissed', '1'); } catch {}
  }
</script>

{#if !dismissed}
  <div class="site-banner" style="background:{color}">
    <div class="site-banner-inner">
      <span class="site-banner-text">{text}</span>
      {#if btn_text && btn_url}
        <a href={btn_url} class="site-banner-btn" target="_blank" rel="noopener noreferrer">{btn_text}</a>
      {/if}
    </div>
    <button class="site-banner-close" onclick={dismiss} aria-label="Dismiss">×</button>
  </div>
{/if}

<style>
  .site-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem 0.45rem 2rem;
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }
  .site-banner-inner {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    min-width: 0;
  }
  .site-banner-text { text-align: center; }
  .site-banner-btn {
    background: rgba(255,255,255,0.2);
    border: 1px solid rgba(255,255,255,0.4);
    border-radius: 4px;
    color: #fff;
    padding: 0.2rem 0.65rem;
    font-size: 12px;
    text-decoration: none;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .site-banner-btn:hover { background: rgba(255,255,255,0.3); text-decoration: none; }
  .site-banner-close {
    flex-shrink: 0;
    background: none;
    border: none;
    color: rgba(255,255,255,0.8);
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.2rem 0.35rem;
    border-radius: 3px;
    align-self: flex-start;
    margin-top: 1px;
  }
  .site-banner-close:hover { color: #fff; background: rgba(0,0,0,0.15); }
</style>
