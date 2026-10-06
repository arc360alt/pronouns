<script lang="ts">
  import { user, waitForUser, dmsEnabled, theme } from '$lib/stores';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    ACCENT_PRESETS, DEFAULT_ACCENT, DEFAULT_VARIANT, SCHEME_VARIANTS,
    saveAccent, saveVariant, loadSavedVariant, buildScheme, schemeColor,
    type SchemeVariant,
  } from '$lib/accent';

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
  let schemeVariant = $state<SchemeVariant>(DEFAULT_VARIANT);
  let dmRequestsEnabled = $state(false);

  const val = (e: Event) => (e.currentTarget as HTMLInputElement).value;

  function pickAccent(hex: string) {
    accentColor = hex;
    saveAccent(hex);
  }

  function pickVariant(v: SchemeVariant) {
    schemeVariant = v;
    saveVariant(v);
  }

  // Android-style swatches: each seed rendered through the active scheme style
  let swatches = $derived(ACCENT_PRESETS.map(p => {
    const sch = buildScheme(p.hex, schemeVariant, $theme === 'dark');
    return {
      ...p,
      primary: schemeColor(sch, 'primary'),
      secondary: schemeColor(sch, 'secondaryContainer'),
      tertiary: schemeColor(sch, 'tertiaryContainer'),
    };
  }));
  let isPreset = $derived(ACCENT_PRESETS.some(p => p.hex === accentColor.toLowerCase()));

  onMount(async () => {
    const me = await waitForUser();
    if (!me) { goto('/login'); return; }
    email = me.email;
    newUsername = me.username;
    calcCooldown(me.username_changed_at);
    accentColor = localStorage.getItem('accent_color') || DEFAULT_ACCENT;
    schemeVariant = loadSavedVariant();

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

<div class="container" style="max-width:560px">
  <h1 class="page-title">Account Settings</h1>

  <!-- Quick links -->
  <div style="display:flex;gap:0.75rem;margin-bottom:1.25rem;flex-wrap:wrap">
    <md-filled-tonal-button href="/settings/profile" style="flex:1;min-width:140px">
      <i slot="icon" class="fa-solid fa-pen"></i> Edit Profile
    </md-filled-tonal-button>
    <md-filled-tonal-button href="/settings/site" style="flex:1;min-width:140px">
      <i slot="icon" class="fa-solid fa-globe"></i> My Site
    </md-filled-tonal-button>
  </div>

  <!-- Username -->
  <div class="card">
    <p class="section-title">Username</p>
    <form onsubmit={handleUsernameChange}>
      <div class="form-group">
        <md-outlined-text-field label="Username" value={newUsername} oninput={(e: Event) => newUsername = val(e)}
          autocomplete="username" placeholder="letters, numbers, _ and -" required minlength="3" maxlength="30"
          pattern="^[a-zA-Z0-9_-]+$"
          supporting-text={cooldownDays > 0
            ? `You can change your username again in ${cooldownDays} day${cooldownDays === 1 ? '' : 's'}`
            : $user?.username_changed_at ? 'You can change your username now' : ''}
        ></md-outlined-text-field>
      </div>
      {#if usernameError}<p class="msg-error">{usernameError}</p>{/if}
      {#if usernameSuccess}<p class="msg-success">{usernameSuccess}</p>{/if}
      <md-filled-button type="submit" style="margin-top:0.25rem" disabled={usernameLoading || cooldownDays > 0 || newUsername === $user?.username}>
        {usernameLoading ? 'Saving…' : 'Change username'}
      </md-filled-button>
    </form>
  </div>

  <!-- Email & Password -->
  <div class="card" style="margin-top:1rem">
    <p class="section-title">Email &amp; password</p>
    <form onsubmit={handleSave}>
      <div class="form-group">
        <md-outlined-text-field label="Email" type="email" value={email} oninput={(e: Event) => email = val(e)} autocomplete="email" required></md-outlined-text-field>
      </div>

      <md-divider style="margin:0.5rem 0 1.25rem"></md-divider>

      <div class="form-group">
        <md-outlined-text-field type="password" value={currentPassword} oninput={(e: Event) => currentPassword = val(e)}
          label={$user?.has_password ? 'Current password' : 'New password'}
          autocomplete="current-password" required={!!$user?.has_password}
          placeholder={$user?.has_password ? '' : 'No password set — enter a new one'}
          supporting-text={$user?.has_password ? 'Required to save any changes' : 'Set a password to enable email/password login'}
        ></md-outlined-text-field>
      </div>
      {#if $user?.has_password}
        <div class="form-group">
          <md-outlined-text-field label="New password" type="password" value={newPassword} oninput={(e: Event) => newPassword = val(e)}
            autocomplete="new-password" placeholder="Leave blank to keep current"></md-outlined-text-field>
        </div>
        {#if newPassword}
          <div class="form-group">
            <md-outlined-text-field label="Confirm new password" type="password" value={confirmPassword} oninput={(e: Event) => confirmPassword = val(e)}
              autocomplete="new-password"></md-outlined-text-field>
          </div>
        {/if}
      {/if}

      {#if error}<p class="msg-error">{error}</p>{/if}
      {#if success}<p class="msg-success">{success}</p>{/if}

      <md-filled-button type="submit" style="margin-top:0.25rem" disabled={loading}>
        {loading ? 'Saving…' : 'Save changes'}
      </md-filled-button>
    </form>
  </div>

  <!-- Google account -->
  {#if googleClientId}
    <div class="card" style="margin-top:1rem">
      <p class="section-title">Google Account</p>
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
    <p class="section-title" style="margin-bottom:0.25rem">Color scheme</p>
    <p style="font-size:14px;color:var(--text-muted);margin-bottom:1.25rem">
      Pick a Material color. A full Material You palette is generated from it for light and dark mode. Applies only to your browser.
    </p>

    <div class="swatch-grid" role="radiogroup" aria-label="Seed color">
      {#each swatches as sw (sw.hex)}
        <button class="swatch" class:selected={accentColor.toLowerCase() === sw.hex}
          role="radio" aria-checked={accentColor.toLowerCase() === sw.hex}
          title={sw.name} aria-label={sw.name} onclick={() => pickAccent(sw.hex)}>
          <span class="swatch-disc">
            <span style="background:{sw.primary}"></span>
            <span style="background:{sw.secondary}"></span>
            <span style="background:{sw.tertiary}"></span>
          </span>
          {#if accentColor.toLowerCase() === sw.hex}
            <span class="swatch-check"><i class="fa-solid fa-check"></i></span>
          {/if}
        </button>
      {/each}
    </div>

    <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-top:1rem">
      <label class="custom-seed" class:selected={!isPreset}>
        <input type="color" value={accentColor} oninput={(e) => pickAccent((e.target as HTMLInputElement).value)} />
        <span>Custom seed {#if !isPreset}<code>{accentColor}</code>{/if}</span>
      </label>
      {#if accentColor !== DEFAULT_ACCENT || schemeVariant !== DEFAULT_VARIANT}
        <md-text-button class="md-sm" onclick={() => { pickVariant(DEFAULT_VARIANT); pickAccent(DEFAULT_ACCENT); }}>
          <i slot="icon" class="fa-solid fa-rotate-left"></i> Reset to default
        </md-text-button>
      {/if}
    </div>

    <p class="form-label" style="margin:1.5rem 0 0.6rem">Scheme style</p>
    <md-chip-set>
      {#each SCHEME_VARIANTS as v (v.id)}
        <md-filter-chip label={v.name} title={v.description} selected={schemeVariant === v.id}
          onclick={(e: Event) => {
            // Chips toggle themselves; keep exactly one selected
            const chip = e.currentTarget as HTMLElement & { selected: boolean };
            pickVariant(v.id);
            queueMicrotask(() => chip.selected = true);
          }}></md-filter-chip>
      {/each}
    </md-chip-set>

    <!-- Live preview of the generated roles -->
    <div class="scheme-preview">
      <div class="role" style="background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary)">Primary</div>
      <div class="role" style="background:var(--md-sys-color-secondary);color:var(--md-sys-color-on-secondary)">Secondary</div>
      <div class="role" style="background:var(--md-sys-color-tertiary);color:var(--md-sys-color-on-tertiary)">Tertiary</div>
      <div class="role" style="background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)">Primary container</div>
      <div class="role" style="background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)">Secondary container</div>
      <div class="role" style="background:var(--md-sys-color-tertiary-container);color:var(--md-sys-color-on-tertiary-container)">Tertiary container</div>
    </div>
  </div>

  <!-- Messaging -->
  {#if $dmsEnabled}
  <div class="card" style="margin-top:1rem">
    <p class="section-title" style="margin-bottom:0.25rem">Messaging</p>
    <p style="font-size:14px;color:var(--text-muted);margin-bottom:1rem">Control who can contact you via Direct Messages.</p>
    <label style="display:flex;align-items:center;justify-content:space-between;gap:1rem;cursor:pointer">
      <div>
        <div style="font-size:16px;color:var(--text)">Accept DM requests</div>
        <div style="font-size:14px;color:var(--text-muted);margin-top:2px">Allow other users to send you direct message requests. Off by default.</div>
      </div>
      <md-switch icons selected={dmRequestsEnabled} onchange={toggleDmRequests} aria-label="Accept DM requests"></md-switch>
    </label>
    <div style="margin-top:1rem">
      <md-outlined-button href="/dms" class="md-sm"><i slot="icon" class="fa-solid fa-message"></i> Go to Direct Messages</md-outlined-button>
    </div>
  </div>
  {/if}

  <!-- Session -->
  <div class="card" style="margin-top:1rem">
    <p class="section-title">Session</p>
    <md-outlined-button onclick={logout}><i slot="icon" class="fa-solid fa-right-from-bracket"></i> Log out of all sessions</md-outlined-button>
  </div>
</div>

<style>
  .swatch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
    gap: 0.6rem;
  }
  .swatch {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    min-height: 0;
    padding: 6px;
    border-radius: var(--md-sys-shape-corner-large);
    background: var(--md-sys-color-surface-container-highest);
    transition: border-radius 0.25s var(--md-motion-standard), background-color 0.2s;
  }
  .swatch.selected {
    border-radius: var(--md-sys-shape-corner-extra-large);
    background: var(--md-sys-color-secondary-container);
  }
  .swatch-disc {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;
  }
  .swatch-disc span:first-child { grid-column: 1 / 3; }
  .swatch-check {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
  }
  .custom-seed {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px 14px 4px 4px;
    border-radius: var(--md-sys-shape-corner-full);
    border: 1px solid var(--md-sys-color-outline-variant);
  }
  .custom-seed.selected {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
    border-color: transparent;
  }
  .custom-seed input {
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 50%;
    overflow: hidden;
    background: none;
  }
  .custom-seed input::-webkit-color-swatch-wrapper { padding: 0; }
  .custom-seed input::-webkit-color-swatch { border: none; border-radius: 50%; }
  .custom-seed input::-moz-color-swatch { border: none; border-radius: 50%; }
  .custom-seed code { font-family: 'Roboto Mono', monospace; font-size: 12px; margin-left: 0.25rem; }
  .scheme-preview {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.4rem;
    margin-top: 1.25rem;
  }
  .role {
    border-radius: var(--md-sys-shape-corner-small);
    padding: 0.75rem 0.7rem;
    font-size: 12px;
    font-weight: 500;
    min-height: 56px;
    display: flex;
    align-items: flex-end;
  }
  @media (max-width: 480px) {
    .scheme-preview { grid-template-columns: repeat(2, 1fr); }
  }
</style>
