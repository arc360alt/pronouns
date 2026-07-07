import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'db.sqlite');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    is_banned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    display_name TEXT,
    bio TEXT,
    gender TEXT,
    pronouns TEXT,
    profile_picture TEXT,
    banner TEXT,
    custom_color TEXT,
    show_friends INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS profile_names (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS profile_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    flag_name TEXT NOT NULL,
    flag_image TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS profile_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    caption TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_username TEXT NOT NULL,
    UNIQUE(user_id, friend_username),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS profile_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    link_label TEXT NOT NULL,
    link_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS custom_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS custom_field_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    value TEXT NOT NULL,
    entry_status TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (field_id) REFERENCES custom_fields(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER,
    reported_user_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    admin_note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'unread',
    admin_note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'message',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Migrate existing databases to add new columns gracefully
const addCol = (table: string, col: string, type: string) => {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch { /* already exists */ }
};
addCol('profiles', 'location', 'TEXT');
addCol('profiles', 'occupation', 'TEXT');
addCol('profiles', 'birthday', 'TEXT');
addCol('profiles', 'website', 'TEXT');
addCol('profiles', 'banner_position', "TEXT DEFAULT '50% 50%'");
addCol('profiles', 'timezone', 'TEXT');
addCol('profile_names', 'preference', 'TEXT');
addCol('custom_field_entries', 'preference', 'TEXT');
addCol('profiles', 'banner_height', 'INTEGER DEFAULT 240');
addCol('profiles', 'avatar_size', 'INTEGER DEFAULT 120');
addCol('profiles', 'show_site', 'INTEGER DEFAULT 0');
addCol('profiles', 'section_order', 'TEXT');
addCol('profiles', 'profile_bg', 'TEXT DEFAULT NULL');
addCol('profiles', 'profile_bg_type', "TEXT NOT NULL DEFAULT 'none'");
addCol('profiles', 'profile_bg_brightness', 'REAL DEFAULT 0.5');
addCol('profiles', 'hide_banner_with_bg', 'INTEGER DEFAULT 0');
addCol('profiles', 'custom_color_2', 'TEXT DEFAULT NULL');
addCol('profiles', 'custom_color_dir', "TEXT NOT NULL DEFAULT '135deg'");
addCol('profiles', 'forced_theme', 'TEXT DEFAULT NULL');
addCol('users', 'google_id', 'TEXT');
addCol('users', 'username_changed_at', 'TEXT');
addCol('profile_links', 'link_icon', 'TEXT DEFAULT NULL');
addCol('profile_links', 'link_icon_mode', "TEXT NOT NULL DEFAULT 'text'");
addCol('profile_links', 'link_icon_size', 'REAL DEFAULT 1.5');

db.exec(`
  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS user_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS site_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    filetype TEXT NOT NULL,
    content TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, filename),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ai_usage (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_badges (
    user_id INTEGER NOT NULL,
    badge_id TEXT NOT NULL,
    awarded_by INTEGER,
    awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
    visible INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, badge_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

export const BADGE_DEFS = [
  { id: 'owner',           name: 'Pronouns.sbs Owner', icon: 'fa-solid fa-crown',  color: '#2752e0', description: 'Platform administrator' },
  { id: 'admin',           name: 'Admin',              icon: 'fa-solid fa-shield-halved',  color: '#e07a27', description: 'Platform administrator' },
  { id: 'og',              name: 'OG',                 icon: 'fa-solid fa-star',           color: '#f5c518', description: 'Joined before June 25, 2026' },
  { id: 'friend_of_owner', name: 'Friend of Owner',    icon: 'fa-solid fa-heart',          color: '#e05c7a', description: 'Personal friend of the owner' },
  { id: 'one_year',        name: '1+ Year of Service', icon: 'fa-solid fa-calendar-check', color: '#4caf50', description: 'Member for over a year' },
  { id: 'gif_badge',        name: 'Found out that you can use gifs as your banner', icon: 'fa-solid fa-calendar-check', color: '#4caf50', description: 'The name explains it all.' },
] as const;

export type BadgeId = typeof BADGE_DEFS[number]['id'];

function computeBadges(userId: number, isAdmin: number, createdAt: string) {
  const earned = new Set<string>();

  if (isAdmin) earned.add('admin');
  if (new Date(createdAt) < new Date('2026-06-25T00:00:00Z')) earned.add('og');
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  if (new Date(createdAt) < oneYearAgo) earned.add('one_year');

  const manual = db.prepare(
    'SELECT badge_id FROM user_badges WHERE user_id = ? AND awarded_by IS NOT NULL'
  ).all(userId) as { badge_id: string }[];
  manual.forEach(r => earned.add(r.badge_id));

  const prefs = db.prepare(
    'SELECT badge_id, visible, sort_order FROM user_badges WHERE user_id = ?'
  ).all(userId) as { badge_id: string; visible: number; sort_order: number }[];
  const prefMap = new Map(prefs.map(p => [p.badge_id, p]));

  return BADGE_DEFS
    .filter(def => earned.has(def.id))
    .map(def => {
      const pref = prefMap.get(def.id);
      return {
        id: def.id,
        name: def.name,
        icon: def.icon,
        color: def.color,
        description: def.description,
        visible: pref ? pref.visible === 1 : true,
        sort_order: pref?.sort_order ?? 0,
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function getFullProfile(userId: number) {
  const profile = db.prepare(`
    SELECT u.username, u.created_at, u.is_admin,
           p.display_name, p.bio, p.gender, p.pronouns,
           p.profile_picture, p.banner, p.banner_position, p.custom_color, p.show_friends,
           p.location, p.occupation, p.birthday, p.website, p.timezone,
           p.banner_height, p.avatar_size, p.show_site, p.section_order,
           p.profile_bg, p.profile_bg_type, p.profile_bg_brightness, p.hide_banner_with_bg, p.custom_color_2, p.custom_color_dir, p.forced_theme,
           CASE WHEN s.enabled = 1 THEN 1 ELSE 0 END AS site_enabled
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN user_sites s ON u.id = s.user_id
    WHERE u.id = ?
  `).get(userId) as (Record<string, unknown> & { is_admin: number; created_at: string }) | undefined;

  if (!profile) return null;

  const names = db.prepare(
    'SELECT id, name, preference, sort_order FROM profile_names WHERE user_id = ? ORDER BY sort_order'
  ).all(userId);
  const flags = db.prepare(
    'SELECT id, flag_name, flag_image, sort_order FROM profile_flags WHERE user_id = ? ORDER BY sort_order'
  ).all(userId);
  const images = db.prepare(
    'SELECT id, image_url, caption, sort_order FROM profile_images WHERE user_id = ? ORDER BY sort_order'
  ).all(userId);
  const friends = db.prepare(
    'SELECT id, friend_username FROM friends WHERE user_id = ?'
  ).all(userId);
  const links = db.prepare(
    'SELECT id, link_label, link_url, sort_order, link_icon, link_icon_mode, link_icon_size FROM profile_links WHERE user_id = ? ORDER BY sort_order'
  ).all(userId);

  const rawFields = db.prepare(
    'SELECT id, field_name, sort_order FROM custom_fields WHERE user_id = ? ORDER BY sort_order'
  ).all(userId) as { id: number; field_name: string; sort_order: number }[];

  const custom_fields = rawFields.map(f => ({
    ...f,
    entries: db.prepare(
      'SELECT id, value, entry_status, preference, sort_order FROM custom_field_entries WHERE field_id = ? ORDER BY sort_order'
    ).all(f.id)
  }));

  const badges = computeBadges(userId, profile.is_admin, profile.created_at);
  const { is_admin: _ia, ...rest } = profile;
  return { ...rest, names, flags, images, friends, links, custom_fields, badges };
}

export default db;
