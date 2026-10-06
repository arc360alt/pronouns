import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { user, theme, forcedTheme } from './stores';

export function toggleTheme() {
  const next = get(theme) === 'dark' ? 'light' : 'dark';
  theme.set(next);
  if (typeof localStorage !== 'undefined') localStorage.setItem('theme', next);
  // Don't touch data-theme while a profile's forced theme is active
  if (!get(forcedTheme) && typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', next);
  }
}

export function logout() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem('token');
  user.set(null);
  goto('/');
}

export function isActivePath(pathname: string, path: string, exact = false) {
  return exact ? pathname === path : pathname === path || pathname.startsWith(path + '/');
}
