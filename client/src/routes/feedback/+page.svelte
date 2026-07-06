<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { user, waitForUser } from '$lib/stores';
  import { api } from '$lib/api';

  const MAX_CHARS = 2000;

  let message = $state('');
  let submitting = $state(false);
  let submitted = $state(false);
  let error = $state('');

  let charsLeft = $derived(MAX_CHARS - message.length);

  onMount(async () => {
    const me = await waitForUser();
    if (!me) goto('/login');
  });
</script>

<svelte:head><title>Send Feedback — pronouns</title></svelte:head>

<div class="container" style="max-width:640px;padding-top:2rem">
  <h1 class="page-title" style="margin-bottom:0.25rem">Send Feedback</h1>
  <p style="color:var(--text-muted);margin-bottom:1.75rem;font-size:14px">
    Have a bug report, feature idea, or general thought? We'd love to hear it.
  </p>

  {#if submitted}
    <div class="card" style="text-align:center;padding:2.5rem 2rem">
      <i class="fa-solid fa-circle-check" style="font-size:2.5rem;color:var(--success);display:block;margin-bottom:1rem"></i>
      <p style="font-size:1.05rem;font-weight:600;margin-bottom:0.5rem">Feedback sent!</p>
      <p style="color:var(--text-muted);font-size:14px;margin-bottom:1.5rem">
        Thanks for taking the time — we'll review it soon.
      </p>
      <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-secondary" onclick={() => { submitted = false; message = ''; }}>Send another</button>
        <a href="/" class="btn btn-primary" style="color:#fff">Back to home</a>
      </div>
    </div>
  {:else}
    <div class="card">
      <div class="warning-box">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div>
          <strong>Community guidelines apply here too.</strong>
          Feedback containing slurs, harassment, threats, or other harmful content may result in your account being restricted or permanently banned.
          Keep it constructive.
        </div>
      </div>

      <div class="form-group" style="margin-top:1.25rem">
        <label class="form-label" for="fb-msg">Your message</label>
        <textarea
          id="fb-msg"
          bind:value={message}
          placeholder="Describe your feedback, bug, or idea in as much detail as you'd like…"
          maxlength={MAX_CHARS}
          rows={7}
          style="resize:vertical"
        ></textarea>
        <div style="text-align:right;font-size:12px;color:{charsLeft < 100 ? 'var(--danger)' : 'var(--text-muted)'};margin-top:4px">
          {charsLeft} characters remaining
        </div>
      </div>

      {#if error}
        <p class="msg-error" style="margin-bottom:1rem">{error}</p>
      {/if}

      <button
        class="btn btn-primary"
        disabled={submitting || !message.trim()}
        onclick={async () => {
          error = '';
          submitting = true;
          try {
            await api.post('/api/feedback', { message });
            submitted = true;
          } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to send feedback';
          } finally {
            submitting = false;
          }
        }}
      >
        {submitting ? 'Sending…' : 'Send feedback'}
      </button>
    </div>
  {/if}
</div>

<style>
  .warning-box {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    background: color-mix(in srgb, var(--warning, #d97706) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--warning, #d97706) 35%, transparent);
    border-radius: var(--radius);
    padding: 0.85rem 1rem;
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--text);
  }
  .warning-box i {
    color: var(--warning, #d97706);
    font-size: 1rem;
    margin-top: 2px;
    flex-shrink: 0;
  }
  .warning-box strong {
    display: block;
    margin-bottom: 0.2rem;
  }
</style>
