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
`);

export function getFullProfile(userId: number) {
  const profile = db.prepare(`
    SELECT u.username, u.created_at,
           p.display_name, p.bio, p.gender, p.pronouns,
           p.profile_picture, p.banner, p.banner_position, p.custom_color, p.show_friends,
           p.location, p.occupation, p.birthday, p.website, p.timezone,
           p.banner_height, p.avatar_size, p.show_site, p.section_order,
           CASE WHEN s.enabled = 1 THEN 1 ELSE 0 END AS site_enabled
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN user_sites s ON u.id = s.user_id
    WHERE u.id = ?
  `).get(userId) as Record<string, unknown> | undefined;

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
    'SELECT id, link_label, link_url, sort_order FROM profile_links WHERE user_id = ? ORDER BY sort_order'
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

  return { ...profile, names, flags, images, friends, links, custom_fields };
}

export default db;
