export const DEFAULT_ACCENT = '#22c5e0';

export const ACCENT_PRESETS = [
  { name: 'Cyan',    hex: '#22c5e0' },
  { name: 'Violet',  hex: '#9b7fe8' },
  { name: 'Rose',    hex: '#e2547a' },
  { name: 'Indigo',  hex: '#6b7ff0' },
  { name: 'Emerald', hex: '#34d399' },
  { name: 'Amber',   hex: '#f59e0b' },
];

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function darken(hex: string, by: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return '#' + rgb.map(v => Math.max(0, v - by).toString(16).padStart(2, '0')).join('');
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

export function applyAccent(hex: string) {
  if (typeof document === 'undefined') return;
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const root = document.documentElement;
  root.style.setProperty('--accent', hex);
  root.style.setProperty('--accent-hover', darken(hex, 20));
  root.style.setProperty('--accent-subtle', `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.15)`);
  root.style.setProperty('--accent-bg', hex);
  updateFavicon(hex);
}

export function loadSavedAccent() {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('accent_color') : null;
  applyAccent(saved || DEFAULT_ACCENT);
  return saved || DEFAULT_ACCENT;
}

export function saveAccent(hex: string) {
  if (typeof localStorage !== 'undefined') localStorage.setItem('accent_color', hex);
  applyAccent(hex);
}
