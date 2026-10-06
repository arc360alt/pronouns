import {
  Blend,
  DynamicScheme,
  Hct,
  MaterialDynamicColors,
  SchemeContent,
  SchemeExpressive,
  SchemeFidelity,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeTonalSpot,
  SchemeVibrant,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';

// Material Design color palette (500 shades) used as Material You seed colors.
export const DEFAULT_ACCENT = '#00bcd4';

export const ACCENT_PRESETS = [
  { name: 'Baseline',    hex: '#6750a4' },
  { name: 'Red',         hex: '#f44336' },
  { name: 'Pink',        hex: '#e91e63' },
  { name: 'Purple',      hex: '#9c27b0' },
  { name: 'Deep Purple', hex: '#673ab7' },
  { name: 'Indigo',      hex: '#3f51b5' },
  { name: 'Blue',        hex: '#2196f3' },
  { name: 'Light Blue',  hex: '#03a9f4' },
  { name: 'Cyan',        hex: '#00bcd4' },
  { name: 'Teal',        hex: '#009688' },
  { name: 'Green',       hex: '#4caf50' },
  { name: 'Light Green', hex: '#8bc34a' },
  { name: 'Lime',        hex: '#cddc39' },
  { name: 'Yellow',      hex: '#ffeb3b' },
  { name: 'Amber',       hex: '#ffc107' },
  { name: 'Orange',      hex: '#ff9800' },
  { name: 'Deep Orange', hex: '#ff5722' },
  { name: 'Brown',       hex: '#795548' },
  { name: 'Blue Grey',   hex: '#607d8b' },
];

export type SchemeVariant = 'tonal_spot' | 'vibrant' | 'expressive' | 'fidelity' | 'content' | 'neutral' | 'monochrome';
export const DEFAULT_VARIANT: SchemeVariant = 'tonal_spot';

export const SCHEME_VARIANTS: { id: SchemeVariant; name: string; description: string }[] = [
  { id: 'tonal_spot', name: 'Tonal spot', description: 'Calm, the Material You default' },
  { id: 'vibrant',    name: 'Vibrant',    description: 'Saturated and colorful' },
  { id: 'expressive', name: 'Expressive', description: 'Playful, shifts hues' },
  { id: 'fidelity',   name: 'Fidelity',   description: 'Stays true to the seed' },
  { id: 'content',    name: 'Content',    description: 'Matches the seed closely' },
  { id: 'neutral',    name: 'Neutral',    description: 'Muted, near-greyscale' },
  { id: 'monochrome', name: 'Monochrome', description: 'Pure greyscale' },
];

const SCHEMES: Record<SchemeVariant, new (hct: Hct, isDark: boolean, contrast: number) => DynamicScheme> = {
  tonal_spot: SchemeTonalSpot,
  vibrant: SchemeVibrant,
  expressive: SchemeExpressive,
  fidelity: SchemeFidelity,
  content: SchemeContent,
  neutral: SchemeNeutral,
  monochrome: SchemeMonochrome,
};

// M3 color roles emitted as --md-sys-color-<role>.
const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'inversePrimary',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'background', 'onBackground', 'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant',
  'surfaceDim', 'surfaceBright', 'surfaceContainerLowest', 'surfaceContainerLow',
  'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest',
  'inverseSurface', 'inverseOnSurface', 'outline', 'outlineVariant', 'shadow', 'scrim', 'surfaceTint',
] as const;

const kebab = (s: string) => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase());

function isHex(hex: string) {
  return /^#[0-9a-f]{6}$/i.test(hex);
}

export function buildScheme(hex: string, variant: SchemeVariant, isDark: boolean): DynamicScheme {
  const Ctor = SCHEMES[variant] ?? SchemeTonalSpot;
  return new Ctor(Hct.fromInt(argbFromHex(isHex(hex) ? hex : DEFAULT_ACCENT)), isDark, 0);
}

export function schemeColor(scheme: DynamicScheme, role: (typeof ROLES)[number]): string {
  return hexFromArgb(MaterialDynamicColors[role].getArgb(scheme));
}

function schemeToCss(scheme: DynamicScheme, seed: number): string {
  const lines = ROLES.map(r => `--md-sys-color-${kebab(r)}:${schemeColor(scheme, r)};`);
  // Custom colors harmonized toward the seed, per the M3 custom-color guidance.
  const tone = scheme.isDark ? 80 : 40;
  const custom = (base: string) => {
    const h = Hct.fromInt(Blend.harmonize(argbFromHex(base), seed));
    return hexFromArgb(Hct.from(h.hue, Math.max(h.chroma, 48), tone).toInt());
  };
  lines.push(`--md-ext-color-success:${custom('#4caf50')};`);
  lines.push(`--md-ext-color-warning:${custom('#ff9800')};`);
  return lines.join('');
}

const LOGO_STAR_MED  = '#a87ce8';
const LOGO_STAR_SMALL = '#f4729b';

const BIG_PATH   = 'M30.5273 28.6142C31.3056 26.2188 34.6944 26.2188 35.4727 28.6142L39.8252 42.0098C40.1733 43.081 41.1716 43.8063 42.298 43.8063H56.3829C58.9016 43.8063 59.9488 47.0293 57.9111 48.5098L46.5162 56.7887C45.6049 57.4508 45.2236 58.6243 45.5717 59.6956L49.9242 73.0911C50.7025 75.4865 47.9608 77.4785 45.9232 75.998L34.5282 67.7191C33.617 67.057 32.383 67.057 31.4718 67.7191L20.0768 75.998C18.0392 77.4785 15.2975 75.4865 16.0758 73.0911L20.4283 59.6956C20.7764 58.6243 20.3951 57.4508 19.4838 56.7887L8.08887 48.5098C6.05122 47.0293 7.09843 43.8063 9.61711 43.8063H23.702C24.8284 43.8063 25.8267 43.081 26.1748 42.0098L30.5273 28.6142Z';
const MED_PATH   = 'M56.5549 19.7578C55.7313 17.3776 58.4346 15.3339 60.5 16.7754L64.4372 19.5233C65.3609 20.1679 66.5946 20.1445 67.4932 19.4652L71.3232 16.5698C73.3324 15.051 76.1114 16.9905 75.3787 19.4002L73.982 23.9939C73.6543 25.0716 74.0579 26.2377 74.9815 26.8823L78.9188 29.6302C80.9842 31.0717 79.9984 34.314 77.4801 34.3618L72.6797 34.453C71.5535 34.4744 70.5692 35.2185 70.2415 36.2962L68.8448 40.8899C68.1121 43.2997 64.7238 43.364 63.9002 40.9838L62.33 36.4465C61.9617 35.382 60.9498 34.6758 59.8236 34.6972L55.0232 34.7884C52.5049 34.8362 51.3967 31.6337 53.4059 30.1148L57.2359 27.2194C58.1345 26.5401 58.4934 25.3595 58.1251 24.2951L56.5549 19.7578Z';
const SMALL_PATH = 'M56.2693 71.8623C54.062 70.6492 54.6966 67.3203 57.1954 67.0043L64.3797 66.0958C65.4972 65.9545 66.3966 65.1097 66.6075 64.0033L67.9636 56.8899C68.4353 54.4157 71.7974 53.9906 72.87 56.2694L75.9541 62.8214C76.4338 63.8405 77.5152 64.4348 78.6327 64.2935L85.817 63.3851C88.3158 63.0691 89.7591 66.1353 87.9232 67.8596L82.645 72.8174C81.824 73.5886 81.5929 74.8007 82.0726 75.8198L85.1567 82.3718C86.2294 84.6506 83.7593 86.9708 81.552 85.7576L75.2058 82.2698C74.2187 81.7273 72.9945 81.8821 72.1734 82.6532L66.8952 87.611C65.0594 89.3354 62.0895 87.7031 62.5612 85.229L63.9172 78.1156C64.1282 77.0091 63.6026 75.8927 62.6155 75.3502L56.2693 71.8623Z';

function buildFaviconSvg(accent: string): string {
  return `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${BIG_PATH}" fill="${accent}"/><path d="${MED_PATH}" fill="${LOGO_STAR_MED}"/><path d="${SMALL_PATH}" fill="${LOGO_STAR_SMALL}"/></svg>`;
}

function updateFavicon(accent: string) {
  const uri = 'data:image/svg+xml,' + encodeURIComponent(buildFaviconSvg(accent));
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = uri;
}

function readVariant(): SchemeVariant {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem('accent_variant') : null;
  return v && v in SCHEMES ? (v as SchemeVariant) : DEFAULT_VARIANT;
}

// Generates full light + dark Material You schemes from a seed color and
// injects them as --md-sys-color-* tokens keyed off [data-theme].
export function applyAccent(hex: string, variant: SchemeVariant = readVariant()) {
  if (typeof document === 'undefined' || !isHex(hex)) return;
  const seed = argbFromHex(hex);
  const light = buildScheme(hex, variant, false);
  const dark = buildScheme(hex, variant, true);

  let el = document.getElementById('md-dynamic-theme') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'md-dynamic-theme';
    document.head.appendChild(el);
  }
  el.textContent =
    `:root,[data-theme="dark"]{${schemeToCss(dark, seed)}}` +
    `[data-theme="light"]{${schemeToCss(light, seed)}}`;

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  updateFavicon(schemeColor(isDark ? dark : light, 'primary'));
}

export function loadSavedAccent() {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('accent_color') : null;
  applyAccent(saved || DEFAULT_ACCENT);
  return saved || DEFAULT_ACCENT;
}

export function loadSavedVariant(): SchemeVariant {
  return readVariant();
}

export function saveAccent(hex: string) {
  if (typeof localStorage !== 'undefined') localStorage.setItem('accent_color', hex);
  applyAccent(hex);
}

export function saveVariant(variant: SchemeVariant) {
  if (typeof localStorage !== 'undefined') localStorage.setItem('accent_variant', variant);
  applyAccent(localStorage.getItem('accent_color') || DEFAULT_ACCENT, variant);
}

// Re-themes the whole page from a profile's custom color while that profile is
// shown. Uses doubled :root selectors so it outranks the viewer's own theme
// regardless of injection order. Pass null to restore the viewer's theme.
export function applyProfileTheme(hex: string | null, hex2?: string | null, dir = '135deg') {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('md-profile-theme');
  if (!hex || !isHex(hex)) { existing?.remove(); return; }

  const seed = argbFromHex(hex);
  const block = (isDark: boolean) => {
    const scheme = buildScheme(hex, 'tonal_spot', isDark);
    let css = schemeToCss(scheme, seed);
    if (hex2 && isHex(hex2)) {
      const p1 = schemeColor(scheme, 'primary');
      const p2 = schemeColor(buildScheme(hex2, 'tonal_spot', isDark), 'primary');
      css += `--accent-bg:linear-gradient(${dir}, ${p1}, ${p2});`;
    }
    return css;
  };

  const el = (existing as HTMLStyleElement | null) ?? document.createElement('style');
  el.id = 'md-profile-theme';
  el.textContent =
    `:root:root,:root:root[data-theme="dark"]{${block(true)}}` +
    `:root:root[data-theme="light"]{${block(false)}}`;
  if (!existing) document.head.appendChild(el);
}
