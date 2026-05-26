import { writable, get } from 'svelte/store';
import type { User } from './types';

export const user = writable<User | null>(null);
export const theme = writable<'dark' | 'light'>('dark');

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
