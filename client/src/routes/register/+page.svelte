<script lang="ts">
  import { goto } from '$app/navigation';
  import { user } from '$lib/stores';
  import { api } from '$lib/api';

  let username = $state('');
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;
    try {
      const res = await api.post<{ token: string; user: import('$lib/types').User }>('/api/auth/register', { username, email, password });
      localStorage.setItem('token', res.token);
      user.set(res.user);
      goto('/settings/profile');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Registration failed';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Register — pronouns</title></svelte:head>

<div class="container" style="max-width:400px">
  <h1 class="page-title">Create account</h1>
  <div class="card">
    <form onsubmit={handleSubmit}>
      <div class="form-group">
        <label class="form-label" for="username">Username</label>
        <input id="username" type="text" bind:value={username} autocomplete="username"
          placeholder="letters, numbers, _ and -" required minlength="3" maxlength="30" />
      </div>
      <div class="form-group">
        <label class="form-label" for="email">Email</label>
        <input id="email" type="email" bind:value={email} autocomplete="email" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="password">Password</label>
        <input id="password" type="password" bind:value={password} autocomplete="new-password"
          placeholder="at least 8 characters" required minlength="8" />
      </div>
      {#if error}<p class="msg-error">{error}</p>{/if}
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:0.5rem" disabled={loading}>
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  </div>
  <p style="margin-top:1rem;text-align:center;font-size:14px;color:var(--text-muted)">
    Already have an account? <a href="/login">Log in</a>
  </p>
</div>
