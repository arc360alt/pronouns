<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { user, waitForUser } from '$lib/stores';
  import { api } from '$lib/api';
  import type { Profile, ProfileName, ProfileFlag, ProfileImage, Friend, ProfileLink, CustomField, CustomFieldEntry, Badge } from '$lib/types';
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
  import ImageCropModal from '$lib/components/ImageCropModal.svelte';
  import PixLoader from '$lib/components/PixLoader.svelte';
  import FaIconPicker from '$lib/components/FaIconPicker.svelte';

  // Basic profile fields
  let displayName = $state('');
  let bio = $state('');
  let gender = $state('');
  let pronouns = $state('');
  let location = $state('');
  let occupation = $state('');
  let birthday = $state('');
  let website = $state('');
  let timezone = $state('');

  const TIMEZONES: string[] = (() => {
    try { return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone'); }
    catch { return ['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','America/Honolulu','America/Toronto','America/Vancouver','America/Sao_Paulo','America/Argentina/Buenos_Aires','Europe/London','Europe/Dublin','Europe/Lisbon','Europe/Paris','Europe/Berlin','Europe/Madrid','Europe/Rome','Europe/Amsterdam','Europe/Brussels','Europe/Vienna','Europe/Warsaw','Europe/Prague','Europe/Stockholm','Europe/Oslo','Europe/Copenhagen','Europe/Helsinki','Europe/Athens','Europe/Istanbul','Europe/Moscow','Europe/Kiev','Africa/Cairo','Africa/Johannesburg','Africa/Lagos','Africa/Nairobi','Asia/Dubai','Asia/Karachi','Asia/Kolkata','Asia/Dhaka','Asia/Bangkok','Asia/Singapore','Asia/Hong_Kong','Asia/Shanghai','Asia/Tokyo','Asia/Seoul','Asia/Jakarta','Australia/Perth','Australia/Adelaide','Australia/Sydney','Australia/Melbourne','Pacific/Auckland','Pacific/Fiji','UTC']; }
  })();
  let customColor = $state('');
  let customColor2 = $state('');
  let customColorDir = $state('135deg');
  let accentGradient = $state(false);
  let forcedTheme = $state<'dark' | 'light' | ''>('');
  let showFriends = $state(true);
  let showSite = $state(false);
  let siteEnabled = $state(false);
  let bannerHeight = $state(240);
  let avatarSize = $state(120);
  let profilePicture = $state('');
  let banner = $state('');
  let bannerPosition = $state('50% 50%');
  let focalX = $state(50);
  let focalY = $state(50);

  // Lists
  let names = $state<ProfileName[]>([]);
  let flags = $state<ProfileFlag[]>([]);
  let images = $state<ProfileImage[]>([]);
  let friends = $state<Friend[]>([]);
  let links = $state<ProfileLink[]>([]);
  let customFields = $state<CustomField[]>([]);
  let badges = $state<Badge[]>([]);
  let badgeDragId = $state<string | null>(null);

  // New item inputs
  let newName = $state('');
  let newFlagName = $state('');
  let newFlagFile = $state<File | null>(null);
  let newFlagPreview = $state('');
  let presetBrowserOpen = $state(false);
  let presetSearch = $state('');

  const F = 'https://commons.wikimedia.org/wiki/Special:FilePath/';
  const PRESET_FLAGS = [
    // Main pride flags (CSS)
    { name: 'Rainbow Pride',                   url: 'css:traditional' },
    { name: 'Rainbow Pride (Gilbert Baker)',    url: 'css:gilbert-baker' },
    { name: 'Philadelphia Pride',              url: 'css:philadelphia' },
    { name: 'Progress Pride',                  url: 'css:progress' },
    { name: 'Intersex-Inclusive Progress',     url: 'css:intersex-inclusive' },
    { name: 'Progress Pride (2017)',           url: 'css:new-pride' },
    { name: 'Straight Ally',                   url: 'css:ally-pride' },
    { name: 'Pink Triangle',                   url: 'css:pink-triangle' },
    { name: 'Social Justice',                  url: 'css:social-justice' },
    // Orientation (CSS)
    { name: 'Bisexual',                        url: 'css:bisexual' },
    { name: 'Pansexual',                       url: 'css:pansexual' },
    { name: 'Asexual',                         url: 'css:asexual' },
    { name: 'Asexual Spectrum',                url: 'css:asexual-spectrum' },
    { name: 'Aromantic',                       url: 'css:aromantic' },
    { name: 'Aromantic Spectrum',              url: 'css:aromantic-spectrum' },
    { name: 'Graysexual',                      url: 'css:graysexual' },
    { name: 'Demisexual',                      url: 'css:demisexual' },
    { name: 'Demiromantic',                    url: 'css:demiromantic' },
    { name: 'Omnisexual',                      url: 'css:omnisexual' },
    { name: 'Polysexual',                      url: 'css:polysexual' },
    { name: 'Abrosexual',                      url: 'css:abrosexual' },
    { name: 'Queer',                           url: 'css:queer' },
    { name: 'Unlabeled',                       url: 'css:unlabeled' },
    // Men/Women loving (CSS)
    { name: 'Gay Men',                         url: 'css:gay-men' },
    { name: 'Lesbian',                         url: 'css:lesbian' },
    { name: 'Lesbian (Labrys)',                url: 'css:labrys' },
    { name: 'Sapphic',                         url: 'css:sapphic' },
    // Gender identity (CSS)
    { name: 'Transgender',                     url: 'css:transgender' },
    { name: 'Trans-Inclusive',                 url: 'css:trans-inclusive' },
    { name: 'Non-binary',                      url: 'css:nonbinary' },
    { name: 'Genderfluid',                     url: 'css:genderfluid' },
    { name: 'Genderqueer',                     url: 'css:genderqueer' },
    { name: 'Agender',                         url: 'css:agender' },
    { name: 'Bigender',                        url: 'css:bigender' },
    { name: 'Demiboy',                         url: 'css:demiboy' },
    { name: 'Demigirl',                        url: 'css:demigirl' },
    { name: 'Demigender',                      url: 'css:demigender' },
    { name: 'Androgyne',                       url: 'css:androgyne' },
    { name: 'Genderflux',                      url: 'css:genderflux' },
    { name: 'Intersex',                        url: 'css:intersex' },
    { name: 'Metagender',                      url: 'css:metagender' },
    { name: 'Neutrois',                        url: 'css:neutrois' },
    { name: 'Pangender',                       url: 'css:pangender' },
    { name: 'Hijra',                           url: 'css:hijra' },
    // Community / subculture (CSS)
    { name: 'Bear Brotherhood',                url: 'css:bear-brotherhood' },
    { name: 'Leather Pride',                   url: 'css:leather' },
    { name: 'Rubber Pride',                    url: 'css:rubber' },
    { name: 'Drag Pride',                      url: 'css:drag' },
    { name: 'Twink',                           url: 'css:twink' },
    { name: 'Puppy Pride',                     url: 'css:puppy' },
    // Other (CSS)
    { name: 'Polyamory',                       url: 'css:polyamory' },
    { name: 'Pride of Africa',                 url: 'css:pride-of-africa' },
    // Wikimedia-only (not in risadams)
    { name: 'Aroace',                          url: F+'Aroace_flag.svg' },
    { name: 'Aceflux',                         url: F+'Acefluxflag.svg' },
    { name: 'Grayromantic',                    url: F+'Gray-aromantic_Pride_Flag.png' },
    { name: 'Achillean / MLM',                 url: F+'MLM_flag.svg' },
    { name: 'Lesbian (Orange-Pink 5-stripe)',  url: F+'Lesbian_Pride_Flag_2019.svg' },
    { name: 'Lesbian (Orange-Pink 7-stripe)',  url: F+'Lesbian_pride_flag_2018.svg' },
    { name: 'Lesbian (Pink)',                  url: F+'Lesbian_Pride_pink_flag.svg' },
    { name: 'Lesbian (Lipstick)',              url: F+'Lipstick_lesbian_Pride_Flag.svg' },
    { name: 'Lesbian (Double-Venus)',          url: F+'Lesbian_Pride_double-Venus_canton_rainbow_flag.svg' },
    { name: 'Transmasculine',                  url: F+'Transmasc_Flag.svg' },
    { name: 'Intergender',                     url: F+'Intergender.png' },
    { name: 'Maverique',                       url: F+'Maverique_flag.svg' },
    { name: 'Femboy',                          url: F+'Femboy_flag.svg' },
    { name: 'Pony Pride',                      url: F+'Pony_Pride_Flag.svg' },
    { name: 'Polyamory (Howell)',              url: F+'Tricolor_Polyamory_Pride_Flag.svg' },
    { name: 'Two-Spirit',                      url: F+'Two-Spirit_Flag.svg' },
    { name: 'Rainbow Gadsden',                 url: F+'Rainbow_Gadsden_flag.svg' },
    // Regional
    { name: 'Brazil Pride',                    url: F+'Brazil_Gay_flag.svg' },
    { name: 'Canada Pride',                    url: F+'Canada_Pride_flag.svg' },
    { name: 'Israel Pride',                    url: F+'Gay_Pride_flag_of_Israel.svg' },
    { name: 'Poland Pride',                    url: F+'Gay_Pride_Flag_of_Poland.svg' },
    { name: 'South Africa Pride',              url: F+'Gay_Flag_of_South_Africa.svg' },
    { name: 'Turkey Pride',                    url: F+'Turkish_Gay_Pride_Flag.svg' },
    { name: 'United Kingdom Pride',            url: F+'Gay_Pride_flag_of_the_United_Kingdom.svg' },
    { name: 'United States Pride',             url: F+'United_States_Gay_Pride_flag.svg' },
  ];

  let filteredPresets = $derived(
    presetSearch.trim()
      ? PRESET_FLAGS.filter(f => f.name.toLowerCase().includes(presetSearch.toLowerCase()))
      : PRESET_FLAGS
  );

  async function addPresetFlag(f: { name: string; url: string }) {
    try {
      const added = await api.post<ProfileFlag>('/api/profile/flags', { flag_name: f.name, flag_image: f.url });
      flags = [...flags, added];
      itemMsg = '';
    } catch (err) {
      itemMsg = err instanceof Error ? err.message : 'Failed';
    }
  }
  let newImageCaption = $state('');
  let newImageFile = $state<File | null>(null);
  let newImagePreview = $state('');
  let newFriend = $state('');
  let newLinkLabel = $state('');
  let newLinkUrl = $state('');
  let newLinkMode = $state<'text' | 'icon' | 'both'>('text');
  let newLinkIcon = $state<string | null>(null);
  let newLinkIconSize = $state(1.5);
  let linkPickerFor = $state<number | 'new' | null>(null);
  let newFieldName = $state('');

  // Per-field new entry inputs (keyed by field id)
  let newEntryValues = $state<Record<number, string>>({});
  let newEntryStatuses = $state<Record<number, string>>({});
  // Field rename inputs (keyed by field id)
  let fieldNameEdits = $state<Record<number, string>>({});

  // Storage quota
  let storageUsed = $state<number | null>(null);
  const storageLimitBytes = 50 * 1024 * 1024;

  function formatBytes(b: number): string {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
  }

  async function loadStorageUsage() {
    try {
      const d = await api.get<{ used: number }>('/api/upload/usage');
      storageUsed = d.used;
    } catch { /* ignore */ }
  }

  function checkStorage(): boolean {
    if (storageUsed !== null && storageUsed >= storageLimitBytes) {
      showSizeToast('Storage limit reached (50 MB). Delete some uploaded files to free up space.');
      return false;
    }
    return true;
  }

  // Status
  let basicSaving = $state(false);
  let basicMsg = $state('');
  let picUploading = $state(false);
  let bannerUploading = $state(false);
  let cropFile = $state<File | null>(null);
  let picUploadInput = $state<HTMLInputElement | undefined>();
  let profileBgType = $state<'none' | 'color' | 'gradient' | 'image' | 'video' | 'youtube'>('none');
  let profileBgColor = $state('#1a1a2e');
  let profileBgColor2 = $state('#6d28d9');
  let profileBgDir = $state('135deg');
  let profileBgUrl = $state('');
  let profileBgBrightness = $state(0.5);
  let hideBannerWithBg = $state(false);
  let sectionBlur = $state(false);
  let sectionBlurAmount = $state(8);
  let sectionBgColor = $state<string | null>(null);
  let sectionBgOpacity = $state(93);
  let profileBgUploading = $state(false);

  const SECTION_LABEL_KEYS = ['info', 'bio', 'names', 'flags', 'images', 'links', 'clock', 'friends'] as const;
  const SECTION_LABEL_DEFAULTS: Record<string, string> = { info: 'Info', bio: '', names: '', flags: 'Flags', images: 'Images', links: 'Links', clock: 'Current time', friends: 'Friends' };
  let sectionLabels = $state<Record<string, string>>({ info: '', bio: '', names: '', flags: '', images: '', links: '', clock: '', friends: '' });
  let sectionLabelsSaving = $state(false);
  let sectionLabelsSaved = $state(false);

  function extractYouTubeId(url: string): string | null {
    if (!url) return null;
    const m = /(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/.exec(url);
    return m ? m[1] : null;
  }
  let loading = $state(true);
  let itemMsg = $state('');
  let sizeToast = $state('');
  let _sizeToastTimer: ReturnType<typeof setTimeout> | null = null;
  function showSizeToast(msg: string) {
    sizeToast = msg;
    if (_sizeToastTimer) clearTimeout(_sizeToastTimer);
    _sizeToastTimer = setTimeout(() => { sizeToast = ''; }, 7000);
  }

  onMount(async () => {
    if (!await waitForUser()) { goto('/login'); return; }
    loadStorageUsage();
    try {
      const data = await api.get<Profile>('/api/profile');
      displayName = data.display_name || '';
      bio = data.bio || '';
      gender = data.gender || '';
      pronouns = data.pronouns || '';
      location = data.location || '';
      occupation = data.occupation || '';
      birthday = data.birthday || '';
      website = data.website || '';
      customColor = data.custom_color || '';
      customColor2 = data.custom_color_2 || '';
      customColorDir = data.custom_color_dir || '135deg';
      accentGradient = !!(data.custom_color_2);
      profileBgType = (data.profile_bg_type as any) || 'none';
      profileBgBrightness = data.profile_bg_brightness ?? 0.5;
      hideBannerWithBg = !!data.hide_banner_with_bg;
      sectionBlur = !!data.section_blur;
      sectionBlurAmount = data.section_blur_amount ?? 8;
      sectionBgColor = data.section_bg_color ?? null;
      sectionBgOpacity = data.section_bg_opacity != null ? Math.round(data.section_bg_opacity) : 93;
      if (data.profile_bg) {
        if (profileBgType === 'color') {
          profileBgColor = data.profile_bg;
        } else if (profileBgType === 'gradient') {
          const m = /linear-gradient\(([^,]+),\s*(#[^\s,)]+)\s*,\s*(#[^\s,)]+)\)/.exec(data.profile_bg);
          if (m) { profileBgDir = m[1].trim(); profileBgColor = m[2]; profileBgColor2 = m[3]; }
        } else {
          profileBgUrl = data.profile_bg;
        }
      }
      forcedTheme = (data.forced_theme as 'dark' | 'light') || '';
      showFriends = !!data.show_friends;
      showSite = !!data.show_site;
      siteEnabled = !!data.site_enabled;
      bannerHeight = data.banner_height ?? 240;
      avatarSize = data.avatar_size ?? 120;
      profilePicture = data.profile_picture || '';
      banner = data.banner || '';
      bannerPosition = data.banner_position || '50% 50%';
      timezone = data.timezone || '';
      const parts = bannerPosition.match(/^(\d+)%\s+(\d+)%$/);
      if (parts) { focalX = parseInt(parts[1]); focalY = parseInt(parts[2]); }
      names = data.names || [];
      flags = data.flags || [];
      images = data.images || [];
      friends = data.friends || [];
      links = data.links || [];
      customFields = data.custom_fields || [];
      customFields.forEach(f => {
        fieldNameEdits[f.id] = f.field_name;
        newEntryValues[f.id] = '';
        newEntryStatuses[f.id] = '';
      });
      badges = data.badges || [];
      if (data.section_labels) {
        try {
          const loaded = JSON.parse(data.section_labels as string) as Record<string, string>;
          for (const k of SECTION_LABEL_KEYS) sectionLabels[k] = loaded[k] ?? '';
        } catch {}
      }
    } catch { /* ignore */ }
    finally { loading = false; }
  });

  async function saveBasic(e: Event) {
    e.preventDefault();
    basicMsg = '';
    basicSaving = true;
    try {
      await api.put('/api/profile', {
        display_name: displayName, bio, gender, pronouns,
        location, occupation, birthday, website, timezone,
        custom_color: customColor,
        custom_color_2: accentGradient && customColor2 ? customColor2 : null,
        custom_color_dir: customColorDir,
        forced_theme: forcedTheme || null,
        show_friends: showFriends, show_site: showSite,
        banner_height: bannerHeight, avatar_size: avatarSize
      });
      basicMsg = '✓ Saved';
      setTimeout(() => basicMsg = '', 3000);
    } catch (err) {
      basicMsg = err instanceof Error ? err.message : 'Save failed';
    } finally {
      basicSaving = false;
    }
  }

  const isVideo = (url?: string | null) => !!(url && url.toLowerCase().endsWith('.mp4'));

  async function uploadFile(file: File | Blob, type?: string): Promise<string> {
    const fd = new FormData();
    fd.append('file', file instanceof File ? file : new File([file], 'upload.jpg', { type: 'image/jpeg' }));
    const url = type ? `/api/upload?type=${type}` : '/api/upload';
    const res = await api.upload(url, fd);
    return res.url;
  }

  async function openPicPicker(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!checkStorage()) { if (picUploadInput) picUploadInput.value = ''; return; }

    // GIFs and MP4s bypass the crop modal (canvas strips animation/video)
    if (file.type === 'image/gif' || file.type === 'video/mp4') {
      picUploading = true;
      try {
        const url = await uploadFile(file, 'pfp');
        await api.put('/api/profile/picture', { url });
        profilePicture = url;
        loadStorageUsage();
      } catch (err) {
        itemMsg = err instanceof Error ? err.message : 'Upload failed';
      } finally {
        picUploading = false;
        if (picUploadInput) picUploadInput.value = '';
      }
      return;
    }

    // All other images go through the crop modal
    cropFile = file;
  }

  async function onCropConfirm(blob: Blob) {
    cropFile = null;
    if (picUploadInput) picUploadInput.value = '';
    if (!checkStorage()) return;
    picUploading = true;
    try {
      const url = await uploadFile(blob, 'pfp');
      await api.put('/api/profile/picture', { url });
      profilePicture = url;
      loadStorageUsage();
    } catch (err) {
      itemMsg = err instanceof Error ? err.message : 'Upload failed';
    } finally {
      picUploading = false;
    }
  }

  function onCropCancel() {
    cropFile = null;
    if (picUploadInput) picUploadInput.value = '';
  }

  async function removeProfilePic() {
    await api.put('/api/profile/picture', { url: null });
    profilePicture = '';
  }

  function showMsg(m: string) { basicMsg = '✓ ' + m; setTimeout(() => basicMsg = '', 3000); }

  function computeProfileBg(): string | null {
    if (profileBgType === 'none') return null;
    if (profileBgType === 'color') return profileBgColor;
    if (profileBgType === 'gradient') return `linear-gradient(${profileBgDir}, ${profileBgColor}, ${profileBgColor2})`;
    return profileBgUrl || null;
  }

  async function saveBg() {
    const bg = computeProfileBg();
    try {
      await api.put('/api/profile/background', {
        profile_bg: bg,
        profile_bg_type: profileBgType,
        profile_bg_brightness: profileBgBrightness,
        hide_banner_with_bg: hideBannerWithBg,
        section_blur: sectionBlur,
        section_blur_amount: sectionBlurAmount,
        section_bg_color: sectionBgColor,
        section_bg_opacity: sectionBgOpacity,
      });
      showMsg('Background saved');
    } catch (err) {
      itemMsg = err instanceof Error ? err.message : 'Failed to save background';
    }
  }

  async function uploadProfileBg(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!checkStorage()) { input.value = ''; return; }
    profileBgUploading = true;
    try {
      const url = await uploadFile(file);
      profileBgUrl = url;
      profileBgType = file.type === 'video/mp4' ? 'video' : 'image';
      await api.put('/api/profile/background', { profile_bg: url, profile_bg_type: profileBgType, profile_bg_brightness: profileBgBrightness, hide_banner_with_bg: hideBannerWithBg, section_blur: sectionBlur, section_blur_amount: sectionBlurAmount, section_bg_color: sectionBgColor, section_bg_opacity: sectionBgOpacity });
      loadStorageUsage();
    } catch (err) { itemMsg = err instanceof Error ? err.message : 'Upload failed'; }
    finally { profileBgUploading = false; input.value = ''; }
  }

  async function removeProfileBg() {
    profileBgUrl = '';
    profileBgType = 'none';
    await api.put('/api/profile/background', { profile_bg: null, profile_bg_type: 'none' });
  }

  let bgPreviewStyle = $derived((() => {
    if (profileBgType === 'color') return `background:${profileBgColor}`;
    if (profileBgType === 'gradient') return `background:linear-gradient(${profileBgDir},${profileBgColor},${profileBgColor2})`;
    if ((profileBgType === 'image') && profileBgUrl) return `background-image:url(${profileBgUrl});background-size:cover;background-position:center`;
    return 'background:var(--bg-input)';
  })());

  let accentBgPreview = $derived(
    accentGradient && customColor && customColor2
      ? `linear-gradient(${customColorDir}, ${customColor}, ${customColor2})`
      : customColor || 'var(--accent)'
  );

  async function uploadBanner(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!checkStorage()) { input.value = ''; return; }

    bannerUploading = true;
    try {
      const url = await uploadFile(file, 'banner');
      focalX = 50; focalY = 50; bannerPosition = '50% 50%';
      await api.put('/api/profile/banner', { url, position: bannerPosition });
      banner = url;
      loadStorageUsage();
    } catch (err) {
      itemMsg = err instanceof Error ? err.message : 'Upload failed';
    } finally {
      bannerUploading = false;
    }
  }

  async function removeBanner() {
    await api.put('/api/profile/banner', { url: null, position: '50% 50%' });
    banner = '';
    focalX = 50; focalY = 50; bannerPosition = '50% 50%';
  }

  function handleFocalClick(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    focalX = Math.round((e.clientX - rect.left) / rect.width * 100);
    focalY = Math.round((e.clientY - rect.top) / rect.height * 100);
    bannerPosition = `${focalX}% ${focalY}%`;
    api.put('/api/profile/banner', { url: banner, position: bannerPosition }).catch(() => {});
  }

  async function addName() {
    if (!newName.trim()) return;
    try {
      const n = await api.post<ProfileName>('/api/profile/names', { name: newName.trim() });
      names = [...names, n];
      newName = '';
    } catch (err) {
      itemMsg = err instanceof Error ? err.message : 'Failed';
    }
  }

  async function removeName(id: number) {
    await api.delete(`/api/profile/names/${id}`);
    names = names.filter(n => n.id !== id);
  }

  async function cycleNamePreference(id: number) {
    const current = names.find(n => n.id === id)?.preference ?? null;
    const next = current === null ? 'favorite' : current === 'favorite' ? 'okay' : null;
    await api.put(`/api/profile/names/${id}`, { preference: next });
    names = names.map(n => n.id === id ? { ...n, preference: next } : n);
  }

  function onFlagFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    newFlagFile = file;
    newFlagPreview = URL.createObjectURL(file);
  }

  async function addFlag() {
    if (!newFlagName.trim() || !newFlagFile) return;
    if (!checkStorage()) return;
    try {
      const url = await uploadFile(newFlagFile);
      const f = await api.post<ProfileFlag>('/api/profile/flags', { flag_name: newFlagName.trim(), flag_image: url });
      flags = [...flags, f];
      newFlagName = '';
      newFlagFile = null;
      newFlagPreview = '';
      loadStorageUsage();
    } catch (err) {
      itemMsg = err instanceof Error ? err.message : 'Failed';
    }
  }

  async function removeFlag(id: number) {
    await api.delete(`/api/profile/flags/${id}`);
    flags = flags.filter(f => f.id !== id);
  }

  function onImageFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    newImageFile = file;
    newImagePreview = URL.createObjectURL(file);
  }

  async function addImage() {
    if (!newImageFile) return;
    if (!checkStorage()) return;
    try {
      const url = await uploadFile(newImageFile);
      const img = await api.post<ProfileImage>('/api/profile/images', { image_url: url, caption: newImageCaption || null });
      images = [...images, img];
      newImageCaption = '';
      newImageFile = null;
      newImagePreview = '';
      loadStorageUsage();
    } catch (err) {
      itemMsg = err instanceof Error ? err.message : 'Failed';
    }
  }

  async function removeImage(id: number) {
    await api.delete(`/api/profile/images/${id}`);
    images = images.filter(i => i.id !== id);
  }

  async function addFriend() {
    if (!newFriend.trim()) return;
    try {
      const f = await api.post<Friend>('/api/profile/friends', { friend_username: newFriend.trim() });
      friends = [...friends, f];
      newFriend = '';
    } catch (err) {
      itemMsg = err instanceof Error ? err.message : 'Failed';
    }
  }

  async function removeFriend(id: number) {
    await api.delete(`/api/profile/friends/${id}`);
    friends = friends.filter(f => f.id !== id);
  }

  async function addLink() {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return;
    try {
      const l = await api.post<ProfileLink>('/api/profile/links', {
        link_label: newLinkLabel.trim(),
        link_url: newLinkUrl.trim(),
        link_icon_mode: newLinkMode,
        link_icon: newLinkIcon,
        link_icon_size: newLinkIconSize,
      });
      links = [...links, l];
      newLinkLabel = '';
      newLinkUrl = '';
      newLinkMode = 'text';
      newLinkIcon = null;
      newLinkIconSize = 1.5;
    } catch (err) {
      itemMsg = err instanceof Error ? err.message : 'Failed';
    }
  }

  async function removeLink(id: number) {
    await api.delete(`/api/profile/links/${id}`);
    links = links.filter(l => l.id !== id);
  }

  async function setLinkMode(id: number, mode: 'text' | 'icon' | 'both') {
    links = links.map(l => l.id === id ? { ...l, link_icon_mode: mode } : l);
    try { await api.put(`/api/profile/links/${id}`, { link_icon_mode: mode }); } catch {}
  }

  async function setLinkIconSize(id: number, size: number) {
    links = links.map(l => l.id === id ? { ...l, link_icon_size: size } : l);
    try { await api.put(`/api/profile/links/${id}`, { link_icon_size: size }); } catch {}
  }

  function handleIconSelect(cls: string) {
    const target = linkPickerFor;
    if (target === 'new') {
      newLinkIcon = cls;
    } else if (typeof target === 'number') {
      links = links.map(l => l.id === target ? { ...l, link_icon: cls } : l);
      api.put(`/api/profile/links/${target}`, { link_icon: cls }).catch(() => {});
    }
    linkPickerFor = null;
  }

  async function addField() {
    if (!newFieldName.trim()) return;
    try {
      const f = await api.post<CustomField>('/api/profile/fields', { field_name: newFieldName.trim() });
      customFields = [...customFields, f];
      fieldNameEdits[f.id] = f.field_name;
      newEntryValues[f.id] = '';
      newEntryStatuses[f.id] = '';
      newFieldName = '';
    } catch (err) {
      itemMsg = err instanceof Error ? err.message : 'Failed';
    }
  }

  async function renameField(id: number) {
    const name = fieldNameEdits[id]?.trim();
    if (!name) return;
    try {
      await api.put(`/api/profile/fields/${id}`, { field_name: name });
      customFields = customFields.map(f => f.id === id ? { ...f, field_name: name } : f);
    } catch { /* ignore */ }
  }

  async function deleteField(id: number) {
    await api.delete(`/api/profile/fields/${id}`);
    customFields = customFields.filter(f => f.id !== id);
  }

  async function addEntry(fieldId: number) {
    const value = newEntryValues[fieldId]?.trim();
    const status = newEntryStatuses[fieldId]?.trim() || undefined;
    if (!value) return;
    try {
      const entry = await api.post<CustomFieldEntry>(`/api/profile/fields/${fieldId}/entries`, { value, entry_status: status });
      customFields = customFields.map(f =>
        f.id === fieldId ? { ...f, entries: [...f.entries, entry] } : f
      );
      newEntryValues[fieldId] = '';
      newEntryStatuses[fieldId] = '';
    } catch (err) {
      itemMsg = err instanceof Error ? err.message : 'Failed';
    }
  }

  async function removeEntry(fieldId: number, entryId: number) {
    await api.delete(`/api/profile/fields/${fieldId}/entries/${entryId}`);
    customFields = customFields.map(f =>
      f.id === fieldId ? { ...f, entries: f.entries.filter(e => e.id !== entryId) } : f
    );
  }

  async function cycleEntryPreference(fieldId: number, entryId: number) {
    const entry = customFields.find(f => f.id === fieldId)?.entries.find(e => e.id === entryId);
    const current = entry?.preference ?? null;
    const next = current === null ? 'favorite' : current === 'favorite' ? 'okay' : null;
    await api.put(`/api/profile/fields/${fieldId}/entries/${entryId}`, { preference: next });
    customFields = customFields.map(f =>
      f.id === fieldId ? { ...f, entries: f.entries.map(e => e.id === entryId ? { ...e, preference: next } : e) } : f
    );
  }

  async function toggleBadgeVisibility(badgeId: string, visible: boolean) {
    await api.put(`/api/profile/badges/${badgeId}/visibility`, { visible });
    badges = badges.map(b => b.id === badgeId ? { ...b, visible } : b);
  }

  function onBadgeDragStart(e: DragEvent, id: string) {
    badgeDragId = id;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  function onBadgeDragOver(e: DragEvent, id: string) {
    e.preventDefault();
    if (!badgeDragId || badgeDragId === id) return;
    const from = badges.findIndex(b => b.id === badgeDragId);
    const to = badges.findIndex(b => b.id === id);
    if (from !== -1 && to !== -1 && from !== to) {
      const next = [...badges];
      next.splice(from, 1);
      next.splice(to, 0, badges[from]);
      badges = next;
    }
  }

  async function onBadgeDragEnd() {
    badgeDragId = null;
    await api.put('/api/profile/badges/order', { order: badges.map(b => b.id) });
  }

  async function saveSectionLabels() {
    sectionLabelsSaving = true;
    try {
      await api.put('/api/profile/section-labels', { section_labels: sectionLabels });
      sectionLabelsSaved = true;
      setTimeout(() => { sectionLabelsSaved = false; }, 2000);
    } catch {}
    finally { sectionLabelsSaving = false; }
  }

  let activeTab = $state<'profile' | 'appearance' | 'content' | 'social'>('profile');
</script>

<svelte:head><title>Edit Profile — pronouns</title></svelte:head>

{#if loading}
  <div class="loading"><PixLoader size={48} /></div>
{:else}
<div class="container" style="max-width:640px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">
    <h1 class="page-title" style="margin-bottom:0">Edit Profile</h1>
    {#if $user}
      <a href="/@{$user.username}" class="btn btn-secondary btn-sm"><i class="fa-solid fa-arrow-up-right-from-square"></i> View profile</a>
    {/if}
  </div>

  <!-- ── Tab nav ── -->
  <div class="editor-tabs">
    <button class="editor-tab" class:active={activeTab === 'profile'} onclick={() => activeTab = 'profile'}>
      <i class="fa-solid fa-user"></i><span>Profile</span>
    </button>
    <button class="editor-tab" class:active={activeTab === 'appearance'} onclick={() => activeTab = 'appearance'}>
      <i class="fa-solid fa-palette"></i><span>Appearance</span>
    </button>
    <button class="editor-tab" class:active={activeTab === 'content'} onclick={() => activeTab = 'content'}>
      <i class="fa-solid fa-layer-group"></i><span>Content</span>
    </button>
    <button class="editor-tab" class:active={activeTab === 'social'} onclick={() => activeTab = 'social'}>
      <i class="fa-solid fa-users"></i><span>Social</span>
    </button>
  </div>

  {#if itemMsg}
    <p class="msg-error" style="margin-bottom:1rem">{itemMsg}</p>
  {/if}

  <!-- ════════════════ PROFILE TAB ════════════════ -->
  {#if activeTab === 'profile'}

  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Basic Info</p>
    <form onsubmit={saveBasic}>
      <div class="form-group">
        <label class="form-label" for="display-name">Display name</label>
        <input id="display-name" type="text" bind:value={displayName} placeholder="Your display name" maxlength="60" />
      </div>
      <div class="settings-grid-2col" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
        <div class="form-group">
          <label class="form-label" for="pronouns">Pronouns</label>
          <input id="pronouns" type="text" bind:value={pronouns} placeholder="e.g. they/them" />
        </div>
        <div class="form-group">
          <label class="form-label" for="gender">Gender</label>
          <input id="gender" type="text" bind:value={gender} placeholder="e.g. nonbinary" />
        </div>
        <div class="form-group">
          <label class="form-label" for="occupation">Occupation</label>
          <input id="occupation" type="text" bind:value={occupation} placeholder="e.g. student, developer" />
        </div>
        <div class="form-group">
          <label class="form-label" for="location">Location</label>
          <input id="location" type="text" bind:value={location} placeholder="e.g. Berlin, Germany" />
        </div>
        <div class="form-group">
          <label class="form-label" for="birthday">Birthday</label>
          <input id="birthday" type="date" bind:value={birthday} />
        </div>
        <div class="form-group">
          <label class="form-label" for="website">Website</label>
          <input id="website" type="url" bind:value={website} placeholder="https://yoursite.com" />
        </div>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label" for="tz">Timezone (shows a live clock on your profile)</label>
        <div style="display:flex;gap:0.5rem">
          <input id="tz" type="text" list="tz-list" bind:value={timezone} placeholder="e.g. America/Chicago" style="flex:1" />
          <button type="button" class="btn btn-secondary btn-sm" style="white-space:nowrap"
            onclick={() => timezone = Intl.DateTimeFormat().resolvedOptions().timeZone}>Detect mine</button>
          {#if timezone}
            <button type="button" class="btn btn-ghost btn-sm" onclick={() => timezone = ''}>Clear</button>
          {/if}
        </div>
        {#if timezone}
          <small style="color:var(--text-muted);font-size:12px">
            Preview: {new Intl.DateTimeFormat('en', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true, timeZone: timezone }).format(new Date())}
          </small>
        {/if}
        <datalist id="tz-list">{#each TIMEZONES as tz}<option value={tz}></option>{/each}</datalist>
      </div>
      <div class="form-group">
        <label class="form-label" for="bio">Bio</label>
        <MarkdownEditor id="bio" bind:value={bio} rows={5} placeholder="Tell people about yourself… (supports **bold**, *italic*, # headings, - lists, [links](url), and more)" />
      </div>
      {#if basicMsg}
        <p class={basicMsg.startsWith('✓') ? 'msg-success' : 'msg-error'}>{basicMsg}</p>
      {/if}
      <button type="submit" class="btn btn-primary" disabled={basicSaving}>
        {basicSaving ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  </div>

  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Accent Color</p>
    <div class="form-group">
      <label class="form-label" for="custom-color">Profile accent color</label>
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
        <input id="custom-color" type="color" bind:value={customColor} style="width:48px;height:36px;padding:2px;cursor:pointer;flex:none" />
        <input type="text" bind:value={customColor} placeholder="#e07a27" style="flex:1" />
        {#if customColor}
          <button type="button" class="btn btn-ghost btn-sm" onclick={() => { customColor = ''; accentGradient = false; customColor2 = ''; }}>Reset</button>
        {/if}
      </div>
      <label style="display:flex;align-items:center;gap:0.5rem;font-size:13px;cursor:pointer;margin-bottom:0.5rem">
        <input type="checkbox" bind:checked={accentGradient} style="width:auto" />
        Use gradient accent
      </label>
      {#if accentGradient}
        <div style="display:flex;flex-direction:column;gap:0.5rem">
          <div style="display:flex;align-items:center;gap:0.75rem">
            <input type="color" bind:value={customColor2} style="width:48px;height:36px;padding:2px;cursor:pointer;flex:none" />
            <input type="text" bind:value={customColor2} placeholder="End color e.g. #c96a1c" style="flex:1" />
          </div>
          <div style="display:flex;gap:0.35rem;flex-wrap:wrap">
            {#each ['45deg','90deg','135deg','180deg','225deg','270deg'] as d}
              <button type="button" class="btn btn-sm {customColorDir === d ? 'btn-primary' : 'btn-ghost'}"
                style="font-size:11px;padding:2px 8px" onclick={() => customColorDir = d}>{d}</button>
            {/each}
          </div>
          {#if customColor && customColor2}
            <div style="height:28px;border-radius:var(--radius);background:{accentBgPreview}"></div>
          {/if}
        </div>
      {/if}
    </div>
    <div class="form-group">
      <label class="form-label">Profile theme</label>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:0.6rem">Force visitors to see your profile in a specific theme.</p>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        {#each [{ val: '', label: "Visitor's setting", icon: 'fa-solid fa-user' }, { val: 'dark', label: 'Always dark', icon: 'fa-solid fa-moon' }, { val: 'light', label: 'Always light', icon: 'fa-solid fa-sun' }] as opt}
          <button type="button" class="btn btn-sm {forcedTheme === opt.val ? 'btn-primary' : 'btn-ghost'}"
            onclick={() => forcedTheme = opt.val as typeof forcedTheme}>
            <i class={opt.icon}></i> {opt.label}
          </button>
        {/each}
      </div>
    </div>
    <div class="form-group" style="flex-direction:row;align-items:center;gap:0.5rem">
      <input id="show-friends" type="checkbox" bind:checked={showFriends} style="width:auto" />
      <label for="show-friends" style="cursor:pointer;font-size:14px">Show friends on my profile</label>
    </div>
    <div class="form-group" style="flex-direction:row;align-items:center;gap:0.5rem">
      <input id="show-site" type="checkbox" bind:checked={showSite} disabled={!siteEnabled} style="width:auto" />
      <label for="show-site" style="cursor:pointer;font-size:14px;{!siteEnabled ? 'opacity:0.5' : ''}">
        Show my personal site link on my profile
        {#if !siteEnabled}<span style="font-size:12px;color:var(--text-muted)"> — enable in <a href="/settings/site" style="color:var(--accent)">My Site</a> first</span>{/if}
      </label>
    </div>
    {#if basicMsg}
      <p class={basicMsg.startsWith('✓') ? 'msg-success' : 'msg-error'}>{basicMsg}</p>
    {/if}
    <button type="button" class="btn btn-primary" onclick={saveBasic} disabled={basicSaving}>
      {basicSaving ? 'Saving…' : 'Save'}
    </button>
  </div>

  <!-- ════════════════ APPEARANCE TAB ════════════════ -->
  {:else if activeTab === 'appearance'}

  <!-- Storage quota -->
  {#if storageUsed !== null}
    <div style="margin-bottom:1rem;padding:0.75rem;background:var(--bg-input);border-radius:var(--radius);border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">
        <span style="font-size:13px;color:var(--text-muted)"><i class="fa-solid fa-hard-drive"></i> Upload storage</span>
        <span style="font-size:13px;font-weight:600;color:{storageUsed >= storageLimitBytes ? 'var(--danger)' : 'var(--text)'}">
          {formatBytes(storageUsed)} <span style="font-weight:400;color:var(--text-muted)">/ 50 MB</span>
        </span>
      </div>
      <div style="height:7px;background:var(--border);border-radius:999px;overflow:hidden">
        <div style="height:100%;width:{Math.min(100, storageUsed / storageLimitBytes * 100).toFixed(1)}%;background:{storageUsed >= storageLimitBytes ? 'var(--danger)' : storageUsed / storageLimitBytes > 0.8 ? 'var(--accent)' : 'var(--success)'};border-radius:999px;transition:width 0.3s"></div>
      </div>
      {#if storageUsed >= storageLimitBytes}
        <p style="font-size:12px;color:var(--danger);margin-top:0.4rem">Limit reached — delete some uploaded files to free space.</p>
      {/if}
    </div>
  {/if}

  <!-- Profile Picture -->
  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Profile Picture</p>
    <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
      {#if profilePicture}
        {#if isVideo(profilePicture)}
          <video src={profilePicture} autoplay loop muted playsinline
            style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:1px solid var(--border)"></video>
        {:else}
          <img src={profilePicture} alt="" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:1px solid var(--border)" />
        {/if}
        <button class="btn btn-danger btn-sm" onclick={removeProfilePic}>Remove</button>
      {:else}
        <div style="width:72px;height:72px;border-radius:50%;background:var(--bg-input);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:var(--text-muted)"><i class="fa-solid fa-user"></i></div>
      {/if}
      <label class="btn btn-secondary btn-sm" style="cursor:pointer">
        {picUploading ? 'Uploading…' : 'Upload image or video'}
        <input bind:this={picUploadInput} type="file" accept="image/*,video/mp4" style="display:none" onchange={openPicPicker} disabled={picUploading} />
      </label>
      <span style="font-size:11px;color:var(--text-muted)">jpg, png, gif, mp4 · counts toward your 50 MB storage</span>
    </div>
  </div>

  <!-- Banner -->
  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Banner</p>
    {#if banner}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      {#if isVideo(banner)}
        <div class="banner-editor" style="height:{bannerHeight}px;margin-bottom:0.5rem" onclick={handleFocalClick}>
          <video src={banner} autoplay loop muted playsinline
            style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:{bannerPosition};pointer-events:none"></video>
          <div class="focal-indicator" style="left:{focalX}%;top:{focalY}%"></div>
          <div style="position:absolute;bottom:8px;left:8px;font-size:11px;background:rgba(0,0,0,0.65);color:#fff;padding:3px 7px;border-radius:3px;pointer-events:none">Click to set focal point</div>
        </div>
      {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div class="banner-editor"
          style="height:{bannerHeight}px;background-image:url({banner});background-position:{bannerPosition};margin-bottom:0.5rem"
          onclick={handleFocalClick}>
          <div class="focal-indicator" style="left:{focalX}%;top:{focalY}%"></div>
          <div style="position:absolute;bottom:8px;left:8px;font-size:11px;background:rgba(0,0,0,0.65);color:#fff;padding:3px 7px;border-radius:3px;pointer-events:none">Click to set focal point</div>
        </div>
      {/if}
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.25rem;align-items:center">
        <button class="btn btn-danger btn-sm" onclick={removeBanner}>Remove banner</button>
        <label class="btn btn-secondary btn-sm" style="cursor:pointer">
          {bannerUploading ? 'Uploading…' : 'Replace'}
          <input type="file" accept="image/*,video/mp4" style="display:none" onchange={uploadBanner} disabled={bannerUploading} />
        </label>
        <span style="font-size:11px;color:var(--text-muted)">jpg, png, gif, mp4 · counts toward your 50 MB storage</span>
      </div>
    {:else}
      <div style="height:160px;background:var(--bg-input);border:2px dashed var(--border);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;margin-bottom:0.75rem">No banner set</div>
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
        <label class="btn btn-secondary btn-sm" style="cursor:pointer">
          {bannerUploading ? 'Uploading…' : 'Upload banner'}
          <input type="file" accept="image/*,video/mp4" style="display:none" onchange={uploadBanner} disabled={bannerUploading} />
        </label>
        <span style="font-size:11px;color:var(--text-muted)">jpg, png, gif, mp4 · counts toward your 50 MB storage</span>
      </div>
    {/if}
  </div>

  <!-- Profile Background -->
  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Profile Background</p>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:1rem">Shown behind your entire profile. Cards become slightly transparent to let it show through.</p>
    <div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-bottom:1rem">
      {#each ([['none','None','fa-ban'],['color','Color','fa-palette'],['gradient','Gradient','fa-fill-drip'],['image','Image / GIF','fa-image'],['video','Video','fa-film'],['youtube','YouTube','fa-brands fa-youtube']] as const) as [val, label, icon]}
        <button type="button" class="btn btn-sm {profileBgType === val ? 'btn-primary' : 'btn-secondary'}" style="font-size:12px"
          onclick={() => { profileBgType = val as typeof profileBgType; if (val === 'none') saveBg(); }}>
          <i class="{icon.startsWith('fa-brands') ? icon : 'fa-solid ' + icon}"></i> {label}
        </button>
      {/each}
    </div>
    {#if profileBgType === 'color'}
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
        <input type="color" bind:value={profileBgColor} style="width:48px;height:36px;padding:2px;cursor:pointer;flex:none" />
        <input type="text" bind:value={profileBgColor} placeholder="#1a1a2e" style="flex:1" />
      </div>
      <div style="height:40px;border-radius:var(--radius);margin-bottom:0.75rem;{bgPreviewStyle}"></div>
      <button type="button" class="btn btn-primary btn-sm" onclick={saveBg}>Save background</button>
    {:else if profileBgType === 'gradient'}
      <div style="display:flex;flex-direction:column;gap:0.6rem;margin-bottom:0.75rem">
        <div style="display:flex;align-items:center;gap:0.75rem">
          <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">Start</span>
          <input type="color" bind:value={profileBgColor} style="width:48px;height:36px;padding:2px;cursor:pointer;flex:none" />
          <input type="text" bind:value={profileBgColor} placeholder="#1a1a2e" style="flex:1" />
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem">
          <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">End&nbsp;&nbsp;</span>
          <input type="color" bind:value={profileBgColor2} style="width:48px;height:36px;padding:2px;cursor:pointer;flex:none" />
          <input type="text" bind:value={profileBgColor2} placeholder="#6d28d9" style="flex:1" />
        </div>
        <div style="display:flex;gap:0.35rem;flex-wrap:wrap">
          {#each ['45deg','90deg','135deg','180deg','225deg','270deg'] as d}
            <button type="button" class="btn btn-sm {profileBgDir === d ? 'btn-primary' : 'btn-ghost'}"
              style="font-size:11px;padding:2px 8px" onclick={() => profileBgDir = d}>{d}</button>
          {/each}
        </div>
        <div style="height:40px;border-radius:var(--radius);{bgPreviewStyle}"></div>
      </div>
      <button type="button" class="btn btn-primary btn-sm" onclick={saveBg}>Save background</button>
    {:else if profileBgType === 'image'}
      {#if profileBgUrl}
        <div style="height:100px;border-radius:var(--radius);background-image:url({profileBgUrl});background-size:cover;background-position:center;margin-bottom:0.75rem;position:relative">
          <button class="upload-preview-remove" style="position:absolute;top:4px;right:4px" onclick={removeProfileBg}>×</button>
        </div>
      {:else}
        <div style="height:80px;background:var(--bg-input);border:2px dashed var(--border);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;margin-bottom:0.75rem">No image set</div>
      {/if}
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
        <label class="btn btn-secondary btn-sm" style="cursor:pointer">
          {profileBgUploading ? 'Uploading…' : 'Upload image or GIF'}
          <input type="file" accept="image/*" style="display:none" onchange={uploadProfileBg} disabled={profileBgUploading} />
        </label>
        <span style="font-size:11px;color:var(--text-muted)">jpg, png, gif · counts toward your 50 MB storage</span>
      </div>
    {:else if profileBgType === 'video'}
      {#if profileBgUrl}
        <div style="height:100px;border-radius:var(--radius);overflow:hidden;margin-bottom:0.75rem;position:relative">
          <video src={profileBgUrl} autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover"></video>
          <button class="upload-preview-remove" style="position:absolute;top:4px;right:4px" onclick={removeProfileBg}>×</button>
        </div>
      {:else}
        <div style="height:80px;background:var(--bg-input);border:2px dashed var(--border);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;margin-bottom:0.75rem">No video set</div>
      {/if}
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
        <label class="btn btn-secondary btn-sm" style="cursor:pointer">
          {profileBgUploading ? 'Uploading…' : 'Upload MP4'}
          <input type="file" accept="video/mp4" style="display:none" onchange={uploadProfileBg} disabled={profileBgUploading} />
        </label>
        <span style="font-size:11px;color:var(--text-muted)">mp4 · counts toward your 50 MB storage</span>
      </div>
    {:else if profileBgType === 'youtube'}
      <div class="form-group" style="margin-bottom:0.75rem">
        <label class="form-label" for="bg-yt-url">YouTube video URL</label>
        <input id="bg-yt-url" type="url" bind:value={profileBgUrl} placeholder="https://www.youtube.com/watch?v=..." />
        {#if profileBgUrl && !extractYouTubeId(profileBgUrl)}
          <p style="font-size:12px;color:var(--danger);margin-top:0.25rem">Couldn't find a video ID — paste a youtube.com or youtu.be link.</p>
        {/if}
        {#if extractYouTubeId(profileBgUrl)}
          <p style="font-size:12px;color:var(--success);margin-top:0.25rem"><i class="fa-solid fa-check"></i> Video ID found: {extractYouTubeId(profileBgUrl)}</p>
        {/if}
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:0.75rem">
        <i class="fa-solid fa-circle-info"></i> The video will autoplay muted. Some videos may not be embeddable.
      </p>
      <button type="button" class="btn btn-primary btn-sm" onclick={saveBg} disabled={!extractYouTubeId(profileBgUrl)}>Save background</button>
    {/if}
    {#if profileBgType !== 'none'}
      <div style="margin-top:1rem;padding-top:0.75rem;border-top:1px solid var(--border)">
        <label style="display:flex;align-items:flex-start;gap:0.5rem;font-size:13px;cursor:pointer;margin-bottom:0.75rem">
          <input type="checkbox" bind:checked={hideBannerWithBg} style="width:auto;margin-top:2px;flex-shrink:0" onchange={saveBg} />
          <span>
            <strong style="display:block;margin-bottom:0.15rem">Hide banner &amp; merge with background</strong>
            <span style="color:var(--text-muted);font-size:12px">Your banner will be hidden so the background fills the page seamlessly.</span>
          </span>
        </label>
        <label class="form-label" style="display:flex;justify-content:space-between">
          <span>Background brightness</span><strong>{Math.round(profileBgBrightness * 100)}%</strong>
        </label>
        <input type="range" min="0" max="1" step="0.05" bind:value={profileBgBrightness}
          style="width:100%;accent-color:var(--accent);margin-top:0.35rem" />
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:2px">
          <span>0% (dark)</span><span>50% (default)</span><span>100% (full)</span>
        </div>
      </div>
    {/if}
  </div>

  <!-- Section Cards -->
  {#if profileBgType !== 'none'}
  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Section Cards</p>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:1rem">Control how the content cards look against your background.</p>

    <div class="form-group">
      <label class="form-label" style="margin-bottom:0.4rem">Card color</label>
      <div style="display:flex;gap:0.4rem;margin-bottom:0.75rem">
        <button type="button"
          class="btn btn-sm {sectionBgColor === null ? 'btn-primary' : 'btn-ghost'}"
          onclick={() => { sectionBgColor = null; saveBg(); }}>
          Theme default
        </button>
        <button type="button"
          class="btn btn-sm {sectionBgColor !== null ? 'btn-primary' : 'btn-ghost'}"
          onclick={() => { if (sectionBgColor === null) sectionBgColor = '#262626'; }}>
          Custom color
        </button>
      </div>
      {#if sectionBgColor !== null}
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
          <input type="color" bind:value={sectionBgColor}
            style="width:48px;height:36px;padding:2px;cursor:pointer;flex:none"
            onchange={saveBg} />
          <input type="text" bind:value={sectionBgColor} placeholder="#262626"
            style="flex:1" onchange={saveBg} />
        </div>
      {/if}
    </div>

    <div class="form-group">
      <label class="form-label" style="display:flex;justify-content:space-between">
        <span>Card opacity</span>
        <strong style="min-width:34px;text-align:right">{sectionBgOpacity}%</strong>
      </label>
      <input type="range" min="0" max="100" step="1" bind:value={sectionBgOpacity}
        style="width:100%;accent-color:var(--accent);margin-top:0.35rem"
        onchange={saveBg} />
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:2px">
        <span>0% (invisible)</span><span>30% (blur default)</span><span>100% (solid)</span>
      </div>
    </div>

    <div class="form-group" style="margin-bottom:0">
      <label style="display:flex;gap:0.6rem;align-items:flex-start;cursor:pointer;user-select:none">
        <input type="checkbox" bind:checked={sectionBlur} style="width:auto;margin-top:2px;flex-shrink:0" onchange={saveBg} />
        <span>
          <strong style="display:block;margin-bottom:0.15rem">Frosted glass blur</strong>
          <span style="color:var(--text-muted);font-size:12px">Blurs the background behind each card. Works best with a lower card opacity.</span>
        </span>
      </label>
      {#if sectionBlur}
        <div style="margin-top:0.75rem">
          <label class="form-label" style="display:flex;justify-content:space-between">
            <span>Blur intensity</span><strong style="min-width:34px;text-align:right">{sectionBlurAmount}px</strong>
          </label>
          <input type="range" min="0" max="40" step="1" bind:value={sectionBlurAmount}
            style="width:100%;accent-color:var(--accent);margin-top:0.35rem" onchange={saveBg} />
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:2px">
            <span>0 (none)</span><span>8 (default)</span><span>40 (heavy)</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
  {/if}

  <!-- Layout -->
  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Layout</p>
    <div class="form-group">
      <label class="form-label" for="banner-height">
        Banner height — <strong>{bannerHeight}px</strong>
        <span style="color:var(--text-muted);font-size:12px;font-weight:400"> (100–400)</span>
      </label>
      <input id="banner-height" type="range" min="100" max="400" step="10"
        bind:value={bannerHeight} style="width:100%;accent-color:var(--accent)" />
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:2px">
        <span>100px</span><span>400px</span>
      </div>
    </div>
    <div class="form-group" style="margin-top:0.75rem">
      <label class="form-label" for="avatar-size">
        Profile picture size — <strong>{avatarSize}px</strong>
        <span style="color:var(--text-muted);font-size:12px;font-weight:400"> (60–180)</span>
      </label>
      <input id="avatar-size" type="range" min="60" max="180" step="10"
        bind:value={avatarSize} style="width:100%;accent-color:var(--accent)" />
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:2px">
        <span>60px</span><span>180px</span>
      </div>
    </div>
    {#if basicMsg}
      <p class={basicMsg.startsWith('✓') ? 'msg-success' : 'msg-error'} style="margin-top:0.75rem">{basicMsg}</p>
    {/if}
    <button type="button" class="btn btn-primary" style="margin-top:0.75rem" onclick={saveBasic} disabled={basicSaving}>
      {basicSaving ? 'Saving…' : 'Save layout'}
    </button>
  </div>

  <!-- ════════════════ CONTENT TAB ════════════════ -->
  {:else if activeTab === 'content'}

  <!-- Section Labels -->
  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Section Labels</p>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:1rem">Rename the default section headers on your profile. Leave blank to use the default name.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem">
      {#each [
        { key: 'info',    label: 'Info divider',  placeholder: 'Info' },
        { key: 'bio',     label: 'Description',   placeholder: 'About' },
        { key: 'names',   label: 'Names',         placeholder: 'Names' },
        { key: 'flags',   label: 'Pride Flags',   placeholder: 'Flags' },
        { key: 'images',  label: 'Images',        placeholder: 'Images' },
        { key: 'links',   label: 'Links',         placeholder: 'Links' },
        { key: 'clock',   label: 'Clock',         placeholder: 'Current time' },
        { key: 'friends', label: 'Friends',       placeholder: 'Friends' },
      ] as s}
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">{s.label}</label>
          <input type="text" maxlength="64" placeholder={s.placeholder} bind:value={sectionLabels[s.key]} />
        </div>
      {/each}
    </div>
    <button class="btn btn-primary btn-sm" onclick={saveSectionLabels} disabled={sectionLabelsSaving}>
      {sectionLabelsSaved ? 'Saved!' : sectionLabelsSaving ? 'Saving…' : 'Save labels'}
    </button>
  </div>

  <!-- Names -->
  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Names</p>
    <div class="tag-list" style="margin-bottom:0.75rem">
      {#each names as n}
        <div class="removable">
          <button class="pref-btn" onclick={() => cycleNamePreference(n.id)} title={n.preference === 'favorite' ? 'Favorite — click to set okay' : n.preference === 'okay' ? 'Okay — click to clear' : 'No preference — click to set favorite'}>
            {#if n.preference === 'favorite'}<i class="fa-solid fa-star" style="color:var(--accent)"></i>
            {:else if n.preference === 'okay'}<i class="fa-solid fa-thumbs-up" style="color:var(--accent)"></i>
            {:else}<i class="fa-regular fa-star" style="color:var(--text-muted)"></i>{/if}
          </button>
          {n.name}
          <button class="remove-btn" onclick={() => removeName(n.id)} title="Remove">×</button>
        </div>
      {:else}
        <span style="font-size:13px;color:var(--text-muted)">No names added yet</span>
      {/each}
    </div>
    <div class="form-row">
      <input type="text" bind:value={newName} placeholder="Add a name…" maxlength="50"
        onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addName())} />
      <button class="btn btn-secondary btn-sm" onclick={addName} disabled={!newName.trim()}>Add</button>
    </div>
  </div>

  <!-- Pride Flags -->
  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Pride Flags</p>
    <div class="flags-grid" style="margin-bottom:0.75rem">
      {#each flags as f}
        <div class="flag-card" style="position:relative">
          {#if f.flag_image.startsWith('css:')}
            <div class="flag {f.flag_image.slice(4)}"></div>
          {:else}
            <img src={f.flag_image} alt={f.flag_name} />
          {/if}
          <div class="flag-card-name">{f.flag_name}</div>
          <button class="upload-preview-remove" style="position:absolute;top:4px;right:4px"
            onclick={() => removeFlag(f.id)} title="Remove">×</button>
        </div>
      {:else}
        <span style="font-size:13px;color:var(--text-muted)">No flags added yet</span>
      {/each}
    </div>
    <div style="margin-bottom:1rem">
      <button class="btn btn-secondary btn-sm" onclick={() => presetBrowserOpen = !presetBrowserOpen}>
        <i class="fa-solid fa-{presetBrowserOpen ? 'chevron-up' : 'list'}"></i>
        {presetBrowserOpen ? 'Hide' : 'Browse'} preset flags
      </button>
    </div>
    {#if presetBrowserOpen}
      <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius);padding:0.75rem;margin-bottom:1rem">
        <input type="text" bind:value={presetSearch} placeholder="Search flags…" style="margin-bottom:0.75rem" />
        <div class="flags-grid" style="max-height:260px;overflow-y:auto">
          {#each filteredPresets as pf}
            {@const alreadyAdded = flags.some(f => f.flag_name === pf.name)}
            <button class="flag-card preset-flag-btn" onclick={() => !alreadyAdded && addPresetFlag(pf)}
              disabled={alreadyAdded} title={alreadyAdded ? 'Already added' : `Add ${pf.name}`}
              style="cursor:{alreadyAdded ? 'default' : 'pointer'};opacity:{alreadyAdded ? 0.45 : 1};border:none;padding:0;text-align:left">
              {#if pf.url.startsWith('css:')}
                <div class="flag {pf.url.slice(4)}"></div>
              {:else}
                <img src={pf.url} alt={pf.name} onerror={(e) => { (e.target as HTMLImageElement).closest('.flag-card')!.style.display='none'; }} />
              {/if}
              <div class="flag-card-name">{pf.name}{#if alreadyAdded} ✓{/if}</div>
            </button>
          {:else}
            <span style="font-size:13px;color:var(--text-muted)">No flags match</span>
          {/each}
        </div>
      </div>
    {/if}
    <div class="form-group">
      <label class="form-label">Upload a custom flag</label>
      <input type="text" bind:value={newFlagName} placeholder="Flag name (e.g. Nonbinary Pride)" style="margin-bottom:0.5rem" />
      {#if newFlagPreview}
        <div class="upload-preview" style="margin-bottom:0.5rem">
          <img src={newFlagPreview} alt="preview" />
          <button class="upload-preview-remove" onclick={() => { newFlagFile = null; newFlagPreview = ''; }}>×</button>
        </div>
      {/if}
      <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
        <label class="btn btn-secondary btn-sm" style="cursor:pointer">
          {newFlagFile ? newFlagFile.name : 'Choose image'}
          <input type="file" accept="image/*" style="display:none" onchange={onFlagFileChange} />
        </label>
        <button class="btn btn-primary btn-sm" onclick={addFlag}
          disabled={!newFlagName.trim() || !newFlagFile}>Add flag</button>
      </div>
    </div>
  </div>

  <!-- Custom Sections -->
  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Custom Sections</p>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:1rem">
      Create named lists for anything — hobbies, languages, favourite media, etc. Each entry can have an optional qualifier in brackets.
    </p>
    {#each customFields as field (field.id)}
      <div class="field-block">
        <div class="field-block-header">
          <input class="field-name-input" type="text" bind:value={fieldNameEdits[field.id]}
            onblur={() => renameField(field.id)}
            onkeydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
          <button class="btn btn-danger btn-sm" onclick={() => deleteField(field.id)}>Delete</button>
        </div>
        <div class="tag-list" style="margin-bottom:0.6rem">
          {#each field.entries as entry}
            <div class="removable">
              <button class="pref-btn" onclick={() => cycleEntryPreference(field.id, entry.id)} title={entry.preference === 'favorite' ? 'Favorite — click to set okay' : entry.preference === 'okay' ? 'Okay — click to clear' : 'No preference — click to set favorite'}>
                {#if entry.preference === 'favorite'}<i class="fa-solid fa-star" style="color:var(--accent)"></i>
                {:else if entry.preference === 'okay'}<i class="fa-solid fa-thumbs-up" style="color:var(--accent)"></i>
                {:else}<i class="fa-regular fa-star" style="color:var(--text-muted)"></i>{/if}
              </button>
              {entry.value}{#if entry.entry_status}<span style="color:var(--text-muted);margin-left:3px">({entry.entry_status})</span>{/if}
              <button class="remove-btn" onclick={() => removeEntry(field.id, entry.id)} title="Remove">×</button>
            </div>
          {:else}
            <span style="font-size:13px;color:var(--text-muted)">No entries yet</span>
          {/each}
        </div>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
          <input type="text" style="flex:2;min-width:120px" placeholder="Entry value…"
            bind:value={newEntryValues[field.id]}
            onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addEntry(field.id))} />
          <input type="text" style="flex:1;min-width:80px" placeholder="Qualifier (optional)"
            bind:value={newEntryStatuses[field.id]}
            onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addEntry(field.id))} />
          <button class="btn btn-secondary btn-sm" onclick={() => addEntry(field.id)}
            disabled={!newEntryValues[field.id]?.trim()}>Add</button>
        </div>
      </div>
    {/each}
    <div class="form-row" style="margin-top:0.25rem">
      <input type="text" bind:value={newFieldName} placeholder="New section name…"
        onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addField())} />
      <button class="btn btn-primary btn-sm" onclick={addField} disabled={!newFieldName.trim()}>+ Add section</button>
    </div>
  </div>

  <!-- Links -->
  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Links</p>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:0.75rem">
      Add links to your other accounts and websites. Your main website can be set in the Profile tab.
    </p>
    <div style="display:flex;flex-direction:column;gap:0.4rem;margin-bottom:0.75rem">
      {#each links as l (l.id)}
        <div class="removable link-item">
          <div class="link-item-info">
            {#if l.link_icon_mode !== 'text' && l.link_icon}
              <i class="{l.link_icon} link-item-icon-preview"></i>
            {/if}
            <span style="font-weight:500">{l.link_label}</span>
            <span class="link-item-url">{l.link_url}</span>
          </div>
          <div class="link-item-controls">
            <div class="link-mode-seg">
              <button class="link-mode-btn" class:active={l.link_icon_mode === 'text'}
                onclick={() => setLinkMode(l.id, 'text')} title="Text only">
                <i class="fa-solid fa-font"></i>
              </button>
              <button class="link-mode-btn" class:active={l.link_icon_mode === 'icon'}
                onclick={() => setLinkMode(l.id, 'icon')} title="Icon only">
                <i class="fa-solid fa-icons"></i>
              </button>
              <button class="link-mode-btn" class:active={l.link_icon_mode === 'both'}
                onclick={() => setLinkMode(l.id, 'both')} title="Icon + Text">
                <i class="fa-solid fa-font"></i><i class="fa-solid fa-icons" style="font-size:0.7em;margin-left:1px"></i>
              </button>
            </div>
            {#if l.link_icon_mode !== 'text'}
              <button class="btn btn-ghost btn-sm link-icon-btn" onclick={() => { linkPickerFor = l.id; }} title="Choose icon">
                {#if l.link_icon}<i class={l.link_icon}></i>{:else}<i class="fa-solid fa-plus"></i>{/if}
              </button>
              <div class="link-size-control">
                <input type="range" min="0.75" max="4" step="0.25"
                  value={l.link_icon_size ?? 1.5}
                  oninput={(e) => { links = links.map(x => x.id === l.id ? { ...x, link_icon_size: parseFloat((e.target as HTMLInputElement).value) } : x); }}
                  onchange={(e) => setLinkIconSize(l.id, parseFloat((e.target as HTMLInputElement).value))} />
                <span class="link-size-val">{(l.link_icon_size ?? 1.5).toFixed(2).replace(/\.?0+$/, '')}×</span>
              </div>
            {/if}
            <button class="remove-btn" onclick={() => removeLink(l.id)} title="Remove">×</button>
          </div>
        </div>
      {:else}
        <span style="font-size:13px;color:var(--text-muted)">No links added yet</span>
      {/each}
    </div>
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:flex-end">
      <input type="text" style="flex:1;min-width:100px" bind:value={newLinkLabel} placeholder="Label (e.g. Twitter)" />
      <input type="url" style="flex:2;min-width:160px" bind:value={newLinkUrl} placeholder="URL" />
      <div class="link-mode-seg">
        <button class="link-mode-btn" class:active={newLinkMode === 'text'} onclick={() => newLinkMode = 'text'} title="Text only"><i class="fa-solid fa-font"></i></button>
        <button class="link-mode-btn" class:active={newLinkMode === 'icon'} onclick={() => newLinkMode = 'icon'} title="Icon only"><i class="fa-solid fa-icons"></i></button>
        <button class="link-mode-btn" class:active={newLinkMode === 'both'} onclick={() => newLinkMode = 'both'} title="Icon + Text"><i class="fa-solid fa-font"></i><i class="fa-solid fa-icons" style="font-size:0.7em;margin-left:1px"></i></button>
      </div>
      {#if newLinkMode !== 'text'}
        <button class="btn btn-ghost btn-sm link-icon-btn" onclick={() => { linkPickerFor = 'new'; }} title="Choose icon">
          {#if newLinkIcon}<i class={newLinkIcon}></i>{:else}<i class="fa-solid fa-plus"></i> Icon{/if}
        </button>
        <div class="link-size-control">
          <input type="range" min="0.75" max="4" step="0.25" bind:value={newLinkIconSize} />
          <span class="link-size-val">{newLinkIconSize.toFixed(2).replace(/\.?0+$/, '')}×</span>
        </div>
      {/if}
      <button class="btn btn-secondary btn-sm" onclick={addLink} disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}>Add</button>
    </div>
  </div>

  <!-- Extra Images -->
  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Extra Images</p>
    <div class="images-grid" style="margin-bottom:0.75rem">
      {#each images as img}
        <div class="image-card" style="position:relative">
          <img src={img.image_url} alt={img.caption || ''} />
          {#if img.caption}<div class="image-card-caption">{img.caption}</div>{/if}
          <button class="upload-preview-remove" style="position:absolute;top:4px;right:4px"
            onclick={() => removeImage(img.id)} title="Remove">×</button>
        </div>
      {:else}
        <span style="font-size:13px;color:var(--text-muted)">No images added yet</span>
      {/each}
    </div>
    <div class="form-group">
      <label class="form-label">Add an image</label>
      <input type="text" bind:value={newImageCaption} placeholder="Caption (optional)" style="margin-bottom:0.5rem" />
      {#if newImagePreview}
        <div class="upload-preview" style="margin-bottom:0.5rem">
          <img src={newImagePreview} alt="preview" />
          <button class="upload-preview-remove" onclick={() => { newImageFile = null; newImagePreview = ''; }}>×</button>
        </div>
      {/if}
      <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
        <label class="btn btn-secondary btn-sm" style="cursor:pointer">
          {newImageFile ? newImageFile.name : 'Choose image'}
          <input type="file" accept="image/*" style="display:none" onchange={onImageFileChange} />
        </label>
        <button class="btn btn-primary btn-sm" onclick={addImage} disabled={!newImageFile}>Add image</button>
      </div>
    </div>
  </div>

  <!-- ════════════════ SOCIAL TAB ════════════════ -->
  {:else if activeTab === 'social'}

  <!-- Badges -->
  {#if badges.length > 0}
  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Badges</p>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:0.75rem">Drag to reorder. Toggle the eye to show or hide a badge on your profile.</p>
    <div style="display:flex;flex-direction:column;gap:0.4rem">
      {#each badges as b (b.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div draggable={true}
          ondragstart={(e) => onBadgeDragStart(e, b.id)}
          ondragover={(e) => onBadgeDragOver(e, b.id)}
          ondragend={onBadgeDragEnd}
          style="display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0.6rem;border-radius:var(--radius);background:var(--card-bg);border:1px solid var(--border);cursor:grab;opacity:{b.visible ? 1 : 0.45}">
          <i class="fa-solid fa-grip-vertical" style="color:var(--text-muted);font-size:12px"></i>
          <span class="profile-badge" style="--badge-color:{b.color}"><i class="{b.icon}"></i> {b.name}</span>
          <span style="flex:1;font-size:12px;color:var(--text-muted)">{b.description}</span>
          <button class="btn btn-ghost btn-sm" style="padding:0.2rem 0.5rem;font-size:12px"
            title={b.visible ? 'Hide badge' : 'Show badge'}
            onclick={() => toggleBadgeVisibility(b.id, !b.visible)}>
            <i class="fa-solid {b.visible ? 'fa-eye' : 'fa-eye-slash'}"></i>
          </button>
        </div>
      {/each}
    </div>
  </div>
  {/if}

  <!-- Friends -->
  <div class="card" style="margin-bottom:1rem">
    <p class="section-title">Friends</p>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:0.75rem">
      Add anyone by name. If they have an account here it'll link to their profile automatically.
    </p>
    <div class="tag-list" style="margin-bottom:0.75rem">
      {#each friends as f}
        <div class="removable">
          {f.friend_username}
          <button class="remove-btn" onclick={() => removeFriend(f.id)} title="Remove">×</button>
        </div>
      {:else}
        <span style="font-size:13px;color:var(--text-muted)">No friends added yet</span>
      {/each}
    </div>
    <div class="form-row">
      <input type="text" bind:value={newFriend} placeholder="Name or @username…"
        onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addFriend())} />
      <button class="btn btn-secondary btn-sm" onclick={addFriend} disabled={!newFriend.trim()}>Add</button>
    </div>
  </div>

  {/if}
</div>
{/if}

{#if cropFile}
  <ImageCropModal
    file={cropFile}
    onConfirm={onCropConfirm}
    onCancel={onCropCancel}
  />
{/if}

{#if linkPickerFor !== null}
  <FaIconPicker
    value={linkPickerFor === 'new' ? newLinkIcon : (links.find(l => l.id === linkPickerFor)?.link_icon ?? null)}
    onselect={handleIconSelect}
    onclose={() => { linkPickerFor = null; }}
  />
{/if}

{#if sizeToast}
  <div class="size-toast">
    <i class="fa-solid fa-triangle-exclamation"></i>
    <span style="flex:1">{sizeToast}</span>
    <button class="size-toast-close" onclick={() => { sizeToast = ''; }} aria-label="Dismiss">×</button>
  </div>
{/if}

<style>
  .editor-tabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 1.25rem;
    border-bottom: 2px solid var(--border);
    padding-bottom: 0;
  }
  .editor-tab {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    border: none;
    background: none;
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border-radius: var(--radius) var(--radius) 0 0;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .editor-tab:hover {
    color: var(--text);
    background: var(--bg-input);
  }
  .editor-tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
    background: none;
  }
  .link-item {
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.4rem;
  }
  .link-item-info {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
    flex: 1;
    overflow: hidden;
  }
  .link-item-icon-preview {
    font-size: 14px;
    flex-shrink: 0;
    width: 1.1rem;
    text-align: center;
  }
  .link-item-url {
    color: var(--text-muted);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex-shrink: 1;
  }
  .link-item-controls {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  .link-mode-seg {
    display: flex;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .link-mode-btn {
    background: none;
    border: none;
    border-right: 1px solid var(--border);
    padding: 0.2rem 0.45rem;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 11px;
    line-height: 1;
    transition: background 0.1s, color 0.1s;
    display: flex;
    align-items: center;
    gap: 1px;
  }
  .link-mode-btn:last-child { border-right: none; }
  .link-mode-btn:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--text); }
  .link-mode-btn.active { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); }
  .link-icon-btn {
    padding: 0.2rem 0.5rem;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .link-size-control {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .link-size-control input[type="range"] {
    width: 72px;
    height: 4px;
    accent-color: var(--accent);
    cursor: pointer;
    padding: 0;
  }
  .link-size-val {
    font-size: 11px;
    color: var(--text-muted);
    width: 34px;
    flex-shrink: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .size-toast {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--danger);
    color: #fff;
    padding: 0.75rem 0.85rem 0.75rem 1rem;
    border-radius: var(--radius);
    font-size: 13px;
    max-width: 440px;
    width: calc(100% - 2rem);
    display: flex;
    align-items: center;
    gap: 0.65rem;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    animation: toast-slide-up 0.18s ease;
    line-height: 1.45;
  }
  @keyframes toast-slide-up {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  .size-toast-close {
    background: none;
    border: none;
    color: #fff;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    opacity: 0.8;
    padding: 0 2px;
    flex-shrink: 0;
  }
  .size-toast-close:hover { opacity: 1; }
</style>
