<script lang="ts">
  import { goto } from '$app/navigation';
  import { user } from '$lib/stores';
  import { api } from '$lib/api';

  let login = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;
    try {
      const res = await api.post<{ token: string; user: import('$lib/types').User }>('/api/auth/login', { login, password });
      localStorage.setItem('token', res.token);
      user.set(res.user);
      goto('/@' + res.user.username);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Login failed';
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
      {#if error}<p class="msg-error">{error}</p>{/if}
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:0.5rem" disabled={loading}>
        {loading ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  </div>
  <p style="margin-top:1rem;text-align:center;font-size:14px;color:var(--text-muted)">
    No account? <a href="/register">Register</a>
  </p>
</div>
