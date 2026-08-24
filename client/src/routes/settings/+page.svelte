<script lang="ts">
  import { user, waitForUser, dmsEnabled } from '$lib/stores';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ACCENT_PRESETS, DEFAULT_ACCENT, saveAccent } from '$lib/accent';

  let email = $state('');
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let success = $state('');
  let loading = $state(false);

  let newUsername = $state('');
  let usernameError = $state('');
  let usernameSuccess = $state('');
  let usernameLoading = $state(false);
  let cooldownDays = $state(0);

  let googleClientId = $state('');
  let googleLinkBtnContainer: HTMLDivElement;
  let googleLinking = $state(false);

  let accentColor = $state(DEFAULT_ACCENT);
  let dmRequestsEnabled = $state(false);

  function pickAccent(hex: string) {
    accentColor = hex;
    saveAccent(hex);
  }

  onMount(async () => {
    const me = await waitForUser();
    if (!me) { goto('/login'); return; }
    email = me.email;
    newUsername = me.username;
    calcCooldown(me.username_changed_at);
    accentColor = localStorage.getItem('accent_color') || DEFAULT_ACCENT;

    try {
      const cfg = await api.get<{ googleClientId: string | null }>('/api/auth/config');
      if (cfg.googleClientId) googleClientId = cfg.googleClientId;
    } catch { /* no google config */ }

    try {
      const dm = await api.get<{ dm_requests_enabled: number }>('/api/dm/settings');
      dmRequestsEnabled = !!dm.dm_requests_enabled;
    } catch {}
  });

  async function toggleDmRequests() {
    dmRequestsEnabled = !dmRequestsEnabled;
    await api.put('/api/dm/settings', { dm_requests_enabled: dmRequestsEnabled });
  }

  function calcCooldown(changedAt: string | null | undefined) {
    if (!changedAt) { cooldownDays = 0; return; }
    const elapsed = (Date.now() - new Date(changedAt).getTime()) / 86400000;
    cooldownDays = Math.max(0, 7 - Math.ceil(elapsed));
  }

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

  async function handleUsernameChange(e: Event) {
    e.preventDefault();
    usernameError = ''; usernameSuccess = '';
    if (!newUsername || newUsername === $user?.username) return;
    usernameLoading = true;
    try {
      const res = await api.put<{ token: string; username: string; username_changed_at: string }>('/api/auth/username', { username: newUsername });
      localStorage.setItem('token', res.token);
      user.update(u => u ? { ...u, username: res.username, username_changed_at: res.username_changed_at } : u);
      usernameSuccess = 'Username changed successfully';
      calcCooldown(res.username_changed_at);
    } catch (err) {
      usernameError = err instanceof Error ? err.message : 'Failed to change username';
    } finally {
      usernameLoading = false;
    }
  }

  function handleGoogleLinkCredential(response: { credential: string }) {
    googleLinking = true;
    error = '';
    (async () => {
      try {
        const res = await api.post<{ message: string; user: import('$lib/types').User }>('/api/auth/google/link', { credential: response.credential });
        user.update(u => u ? { ...u, google_id: res.user.google_id } : u);
        success = 'Google account linked successfully';
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to link Google account';
      } finally {
        googleLinking = false;
      }
    })();
  }

  $effect(() => {
    if (googleClientId && googleLinkBtnContainer && typeof google !== 'undefined' && google.accounts?.id) {
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleLinkCredential
      });
      try {
        google.accounts.id.renderButton(googleLinkBtnContainer, { theme: 'outline', size: 'large', width: 300 });
      } catch { /* already rendered */ }
    }
  });

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

  <!-- Username -->
  <div class="card">
    <p class="section-title" style="margin-bottom:0.75rem">Username</p>
    <form onsubmit={handleUsernameChange}>
      <div class="form-group">
        <label class="form-label" for="username">Username</label>
        <input id="username" type="text" bind:value={newUsername} autocomplete="username"
          placeholder="letters, numbers, _ and -" required minlength="3" maxlength="30"
          pattern="^[a-zA-Z0-9_-]+$" />
        {#if cooldownDays > 0}
          <small style="font-size:12px;color:var(--warning)">
            You can change your username again in {cooldownDays} day{cooldownDays === 1 ? '' : 's'}
          </small>
        {:else if $user?.username_changed_at}
          <small style="font-size:12px;color:var(--success)">You can change your username now</small>
        {/if}
      </div>
      {#if usernameError}<p class="msg-error">{usernameError}</p>{/if}
      {#if usernameSuccess}<p class="msg-success">{usernameSuccess}</p>{/if}
      <button type="submit" class="btn btn-primary" style="margin-top:0.5rem" disabled={usernameLoading || cooldownDays > 0 || newUsername === $user?.username}>
        {usernameLoading ? 'Saving…' : 'Change username'}
      </button>
    </form>
  </div>

  <!-- Email & Password -->
  <div class="card" style="margin-top:1rem">
    <form onsubmit={handleSave}>
      <div class="form-group">
        <label class="form-label" for="email">Email</label>
        <input id="email" type="email" bind:value={email} autocomplete="email" required />
      </div>

      <hr />

      <p class="form-label" style="margin-bottom:0.75rem">Change password</p>
      <div class="form-group">
        <label class="form-label" for="current-pw">
          {#if $user?.has_password}
            Current password <span style="color:var(--danger)">*</span>
          {:else}
            New password
          {/if}
        </label>
        <input id="current-pw" type="password" bind:value={currentPassword} autocomplete="current-password"
          required={!!$user?.has_password} placeholder={$user?.has_password ? '' : 'No password set — enter a new one'} />
        {#if $user?.has_password}
          <small style="font-size:12px;color:var(--text-muted)">Required to save any changes</small>
        {:else}
          <small style="font-size:12px;color:var(--text-muted)">Set a password to enable email/password login</small>
        {/if}
      </div>
      {#if $user?.has_password}
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
      {/if}

      {#if error}<p class="msg-error">{error}</p>{/if}
      {#if success}<p class="msg-success">{success}</p>{/if}

      <button type="submit" class="btn btn-primary" style="margin-top:0.5rem" disabled={loading}>
        {loading ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  </div>

  <!-- Google account -->
  {#if googleClientId}
    <div class="card" style="margin-top:1rem">
      <p class="section-title" style="margin-bottom:0.75rem">Google Account</p>
      {#if $user?.google_id}
        <p style="font-size:14px;color:var(--success);margin-bottom:0.5rem">
          <i class="fa-brands fa-google"></i> Google account linked
        </p>
        <small style="font-size:12px;color:var(--text-muted)">You can sign in with Google</small>
      {:else}
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:0.75rem">Link your Google account for easy sign-in</p>
        <div style="display:flex;justify-content:center">
          <div bind:this={googleLinkBtnContainer}></div>
        </div>
        {#if googleLinking}<p style="text-align:center;font-size:13px;color:var(--text-muted);margin-top:0.5rem">Linking Google account…</p>{/if}
      {/if}
    </div>
  {/if}

  <!-- Appearance -->
  <div class="card" style="margin-top:1rem">
    <p class="section-title" style="margin-bottom:0.25rem">Appearance</p>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:1rem">Choose an accent color for the site. Applies only to your browser.</p>

    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem">
      {#each ACCENT_PRESETS as preset}
        <button
          onclick={() => pickAccent(preset.hex)}
          title={preset.name}
          style="width:32px;height:32px;min-width:32px;min-height:32px;padding:0;border-radius:50%;background:{preset.hex};border:3px solid {accentColor === preset.hex ? 'var(--text)' : 'transparent'};outline:2px solid {accentColor === preset.hex ? preset.hex : 'transparent'};outline-offset:1px;cursor:pointer;transition:transform 0.1s,border-color 0.1s;"
          onmouseenter={(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)'}
          onmouseleave={(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
        ></button>
      {/each}
    </div>

    <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
      <label style="font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:0.5rem;cursor:pointer">
        Custom color
        <input type="color" value={accentColor} oninput={(e) => pickAccent((e.target as HTMLInputElement).value)}
          style="width:36px;height:28px;padding:2px;cursor:pointer;border-radius:4px;border:1px solid var(--border);background:var(--bg-input)" />
      </label>
      {#if accentColor !== DEFAULT_ACCENT}
        <button class="btn btn-ghost btn-sm" onclick={() => pickAccent(DEFAULT_ACCENT)}>Reset to default</button>
      {/if}
    </div>
  </div>

  <!-- Messaging -->
  {#if $dmsEnabled}
  <div class="card" style="margin-top:1rem">
    <p class="section-title" style="margin-bottom:0.25rem">Messaging</p>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:1rem">Control who can contact you via Direct Messages.</p>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem">
      <div>
        <div style="font-size:14px;font-weight:500;color:var(--text)">Accept DM requests</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Allow other users to send you direct message requests. Off by default.</div>
      </div>
      <button
        onclick={toggleDmRequests}
        style="flex-shrink:0;width:44px;height:24px;border-radius:999px;border:none;cursor:pointer;position:relative;padding:0;transition:background 0.2s;background:{dmRequestsEnabled ? 'var(--accent)' : 'var(--border)'}"
        title={dmRequestsEnabled ? 'Turn off DM requests' : 'Turn on DM requests'}
      >
        <span style="position:absolute;top:3px;left:{dmRequestsEnabled ? '23px' : '3px'};width:18px;height:18px;background:#fff;border-radius:50%;transition:left 0.2s;display:block"></span>
      </button>
    </div>
    <div style="margin-top:1rem">
      <a href="/dms" class="btn btn-secondary btn-sm"><i class="fa-solid fa-message"></i> Go to Direct Messages</a>
    </div>
  </div>
  {/if}

  <!-- Session -->
  <div class="card" style="margin-top:1rem">
    <p class="section-title" style="margin-bottom:0.75rem">Session</p>
    <button class="btn btn-secondary" onclick={logout}>Log out of all sessions</button>
  </div>
</div>
