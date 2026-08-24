import { writable, get } from 'svelte/store';
import type { User } from './types';

export const user = writable<User | null>(null);
export const theme = writable<'dark' | 'light'>('dark');
export const notifUnread = writable<number>(0);
export const dmUnread = writable<number>(0);
export const dmsEnabled = writable<boolean>(false);
export const forcedTheme = writable<'dark' | 'light' | null>(null);

// Resolves to true once the layout has finished the /api/auth/me check.
// Pages should await waitForUser() before running auth guards so they
// don't redirect to /login during the initial hydration race.
export const userReady = writable<boolean>(false);

export function waitForUser(): Promise<User | null> {
  return new Promise(resolve => {
    if (get(userReady)) { resolve(get(user)); return; }
    const unsub = userReady.subscribe(ready => {
      if (ready) { unsub(); resolve(get(user)); }
    });
  });
}
