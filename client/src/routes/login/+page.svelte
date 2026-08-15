<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { user } from '$lib/stores';
  import { api } from '$lib/api';

  let login = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);
  let captchaToken = $state('');

  const siteKey = '0x4AAAAAACCGRUg6dAwVN1Ai';
  let captchaContainer: HTMLDivElement;
  let captchaWidgetId: string | null = null;

  let googleClientId = $state('');
  let googleBtnContainer: HTMLDivElement;
  let googleLoading = $state(false);
  let turnstileEnabled = $state(true);

  onMount(async () => {
    try {
      const cfg = await api.get<{ googleClientId: string | null; turnstileEnabled: boolean }>('/api/auth/config');
      if (cfg.googleClientId) googleClientId = cfg.googleClientId;
      turnstileEnabled = cfg.turnstileEnabled ?? true;
    } catch { /* no config */ }

    if (turnstileEnabled && captchaContainer) {
      function renderCaptcha() {
        if (typeof turnstile !== 'undefined' && captchaContainer) {
          try {
            captchaWidgetId = turnstile.render(captchaContainer, {
              sitekey: siteKey,
              callback: (token: string) => { captchaToken = token; },
              'expired-callback': () => { captchaToken = ''; }
            });
          } catch { /* already rendered */ }
        } else {
          setTimeout(renderCaptcha, 200);
        }
      }
      renderCaptcha();
    }
  });

  function handleGoogleCredential(response: { credential: string }) {
    googleLoading = true;
    error = '';
    (async () => {
      try {
        const body: Record<string, unknown> = { credential: response.credential };
        if (captchaToken) body.captchaToken = captchaToken;
        const res = await api.post<{ token: string; user: import('$lib/types').User }>('/api/auth/google', body);
        localStorage.setItem('token', res.token);
        user.set(res.user);
        goto('/@' + res.user.username);
      } catch (err) {
        error = err instanceof Error ? err.message : 'Google sign in failed';
      } finally {
        googleLoading = false;
      }
    })();
  }

  $effect(() => {
    if (googleClientId && googleBtnContainer && typeof google !== 'undefined' && google.accounts?.id) {
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential
      });
      try {
        google.accounts.id.renderButton(googleBtnContainer, { theme: 'outline', size: 'large', width: 300 });
      } catch { /* already rendered */ }
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';

    if (turnstileEnabled && !captchaToken) {
      error = 'Please complete the captcha';
      return;
    }

    loading = true;
    try {
      const body: Record<string, unknown> = { login, password };
      if (captchaToken) body.captchaToken = captchaToken;
      const res = await api.post<{ token: string; user: import('$lib/types').User }>('/api/auth/login', body);
      localStorage.setItem('token', res.token);
      user.set(res.user);
      goto('/@' + res.user.username);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Login failed';
      if (captchaWidgetId !== null && typeof turnstile !== 'undefined') {
        turnstile.reset(captchaWidgetId);
        captchaToken = '';
      }
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Log in — pronouns</title></svelte:head>

<div class="container" style="max-width:400px">
  <h1 class="page-title">Log in</h1>
  <div class="card">
    <form onsubmit={handleSubmit}>
      <div class="form-group">
        <label class="form-label" for="login">Username or email</label>
        <input id="login" type="text" bind:value={login} autocomplete="username" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="password">Password</label>
        <input id="password" type="password" bind:value={password} autocomplete="current-password" required />
      </div>
      {#if turnstileEnabled}
      <div class="form-group" style="display:flex;justify-content:center">
        <div bind:this={captchaContainer}></div>
      </div>
      {/if}
      {#if error}<p class="msg-error">{error}</p>{/if}
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:0.5rem" disabled={loading}>
        {loading ? 'Logging in…' : 'Log in'}
      </button>
    </form>

    {#if googleClientId}
      <hr style="margin:1rem 0" />
      <p style="text-align:center;font-size:14px;color:var(--text-muted);margin-bottom:0.75rem">or sign in with</p>
      <div style="display:flex;justify-content:center">
        <div bind:this={googleBtnContainer}></div>
      </div>
      {#if googleLoading}<p style="text-align:center;font-size:13px;color:var(--text-muted);margin-top:0.5rem">Signing in with Google…</p>{/if}
    {/if}
  </div>
  <p style="margin-top:1rem;text-align:center;font-size:14px;color:var(--text-muted)">
    No account? <a href="/register">Register</a>
  </p>
</div>
