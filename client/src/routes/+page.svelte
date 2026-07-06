<script lang="ts">
  import { user } from '$lib/stores';
  import updates from '$lib/updates.json';

  const SHOW_DEFAULT = 3;
  let showAll = $state(false);
  let visible = $derived(showAll ? updates : updates.slice(0, SHOW_DEFAULT));

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' });
  }
</script>

<svelte:head>
  <title>pronouns — Your new favorite pronouns sharing app!</title>
</svelte:head>

<div class="container">
  <div class="home-hero">
    <h1>pronouns<span>.sbs</span></h1>
    <p class="tagline">Create and share <em>all</em> of your pronouns</p>

    {#if $user}
      <a href="/@{$user.username}" class="btn btn-primary">View my profile</a>
      <a href="/settings/profile" class="btn btn-secondary" style="margin-left:0.5rem">Edit profile</a>
    {:else}
      <a href="/register" class="btn btn-primary">Log in or sign up</a>
    {/if}

    <p style="margin-top:1.5rem; color:var(--text-muted); max-width:600px; line-height:1.8;">
      Everybody uses pronouns to refer to others. Whether it be he/him, she/her, they/them,
      or anything else — everybody has preferences. But how do you know which pronouns you should use?
    </p>
    <p style="margin-top:0.75rem; color:var(--text-muted); max-width:600px; line-height:1.8;">
      This is a service where you can create and share a list of your preferred names, pronouns,
      and terms to share with other people. Add flags, extra images, and link to your friends' profiles.
    </p>

    <div class="home-cards">
      <div class="home-card">
        <h3>In-depth profiles</h3>
        <p>Add your pronouns, gender, names you go by, pride flags, a bio, extra images, and more.</p>
      </div>
      <div class="home-card">
        <h3>Share via link</h3>
        <p>Your profile lives at <code style="font-size:12px;color:var(--accent)">/@username</code> — share it anywhere you like.</p>
      </div>
      <div class="home-card">
        <h3>Up to date and secure</h3>
        <p>Unlike pronouns.cc wich has not been updated in 2+ years, this app is up to date and very secure.</p>
      </div>
      <div class="home-card">
        <h3>Connect with friends</h3>
        <p>Link to friends' profiles directly on your own page so people can find the people you know.</p>
      </div>
      <div class="home-card">
        <h3>Custom websites</h3>
        <p>Alongside having your own profile, you can create your own custom website that we will host for you (You can find this by going to Settings, then My Site).</p>
      </div>
      <div class="home-card">
        <h3>Have fun :3</h3>
        <p>Have fun using our app, customize your profile to your hearts content!</p>
      </div>
    </div>

    <div class="updates-section">
      <h2 class="updates-heading">
        <i class="fa-solid fa-clock-rotate-left"></i> Recent Updates
      </h2>
      <div class="updates-list">
        {#each visible as update, i}
          <div class="update-entry" class:update-latest={i === 0}>
            <div class="update-meta">
              <span class="update-version">{update.version}</span>
              {#if i === 0}<span class="update-badge">Latest</span>{/if}
              <span class="update-date">{fmtDate(update.date)}</span>
            </div>
            <p class="update-title">{update.title}</p>
            <ul class="update-changes">
              {#each update.changes as change}
                <li>{change}</li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
      {#if updates.length > SHOW_DEFAULT}
        <button class="updates-show-more" onclick={() => showAll = !showAll}>
          {#if showAll}
            <i class="fa-solid fa-chevron-up"></i> Show less
          {:else}
            <i class="fa-solid fa-chevron-down"></i> Show {updates.length - SHOW_DEFAULT} older update{updates.length - SHOW_DEFAULT === 1 ? '' : 's'}
          {/if}
        </button>
      {/if}
    </div>
  </div>
</div>
