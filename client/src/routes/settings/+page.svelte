<script lang="ts">
  import { user, waitForUser } from '$lib/stores';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let email = $state('');
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let success = $state('');
  let loading = $state(false);

  onMount(async () => {
    const me = await waitForUser();
    if (!me) { goto('/login'); return; }
    email = me.email;
  });

  async function handleSave(e: Event) {
    e.preventDefault();
    error = ''; success = '';
    if (newPassword && newPassword !== confirmPassword) {
      error = 'New passwords do not match';
      return;
    }
    loading = true;
    try {
      await api.put('/api/auth/account', { email, currentPassword, newPassword: newPassword || undefined });
      success = 'Account updated successfully';
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      if (email !== $user?.email) {
        user.update(u => u ? { ...u, email } : u);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Update failed';
    } finally {
      loading = false;
    }
  }

  function logout() {
    localStorage.removeItem('token');
    user.set(null);
    goto('/');
  }
</script>

<svelte:head><title>Settings — pronouns</title></svelte:head>

<div class="container" style="max-width:500px">
  <h1 class="page-title">Account Settings</h1>

  <!-- Quick links -->
  <div style="display:flex;gap:0.75rem;margin-bottom:1.25rem;flex-wrap:wrap">
    <a href="/settings/profile" class="btn btn-secondary" style="flex:1;text-align:center;min-width:120px">
      <i class="fa-solid fa-pen"></i> Edit Profile
    </a>
    <a href="/settings/site" class="btn btn-secondary" style="flex:1;text-align:center;min-width:120px">
      <i class="fa-solid fa-globe"></i> My Site
    </a>
  </div>

  <div class="card">
    <form onsubmit={handleSave}>
      <div class="form-group">
        <label class="form-label" for="email">Email</label>
        <input id="email" type="email" bind:value={email} autocomplete="email" required />
      </div>

      <hr />

      <p class="form-label" style="margin-bottom:0.75rem">Change password</p>
      <div class="form-group">
        <label class="form-label" for="current-pw">Current password <span style="color:var(--danger)">*</span></label>
        <input id="current-pw" type="password" bind:value={currentPassword} autocomplete="current-password" required />
        <small style="font-size:12px;color:var(--text-muted)">Required to save any changes</small>
      </div>
      <div class="form-group">
        <label class="form-label" for="new-pw">New password</label>
        <input id="new-pw" type="password" bind:value={newPassword} autocomplete="new-password" placeholder="Leave blank to keep current" />
      </div>
      {#if newPassword}
        <div class="form-group">
          <label class="form-label" for="confirm-pw">Confirm new password</label>
          <input id="confirm-pw" type="password" bind:value={confirmPassword} autocomplete="new-password" />
        </div>
      {/if}

      {#if error}<p class="msg-error">{error}</p>{/if}
      {#if success}<p class="msg-success">{success}</p>{/if}

      <button type="submit" class="btn btn-primary" style="margin-top:0.5rem" disabled={loading}>
        {loading ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  </div>

  <div class="card" style="margin-top:1rem">
    <p class="section-title" style="margin-bottom:0.75rem">Session</p>
    <button class="btn btn-secondary" onclick={logout}>Log out of all sessions</button>
  </div>
</div>
