export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_banned: boolean;
  created_at?: string;
  google_id?: string | null;
  has_password?: boolean;
  username_changed_at?: string | null;
}

export interface ProfileName {
  id: number;
  name: string;
  preference: 'favorite' | 'okay' | null;
  sort_order: number;
}

export interface ProfileFlag {
  id: number;
  flag_name: string;
  flag_image: string;
  sort_order: number;
}

export interface ProfileImage {
  id: number;
  image_url: string;
  caption: string | null;
  sort_order: number;
}

export interface Friend {
  id: number;
  friend_username: string;
}

export interface ProfileLink {
  id: number;
  link_label: string;
  link_url: string;
  sort_order: number;
}

export interface CustomFieldEntry {
  id: number;
  value: string;
  entry_status: string | null;
  preference: 'favorite' | 'okay' | null;
  sort_order: number;
}

export interface CustomField {
  id: number;
  field_name: string;
  sort_order: number;
  entries: CustomFieldEntry[];
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  visible: boolean;
  sort_order: number;
}

export interface Profile {
  user_id: number;
  username: string;
  display_name: string | null;
  bio: string | null;
  gender: string | null;
  pronouns: string | null;
  location: string | null;
  occupation: string | null;
  birthday: string | null;
  website: string | null;
  timezone: string | null;
  banner_height: number | null;
  avatar_size: number | null;
  profile_picture: string | null;
  banner: string | null;
  banner_position: string | null;
  custom_color: string | null;
  custom_color_2: string | null;
  custom_color_dir: string;
  profile_bg: string | null;
  profile_bg_type: string;
  profile_bg_brightness: number;
  show_friends: boolean | number;
  show_site: boolean | number;
  site_enabled: boolean | number;
  section_order: string | null;
  created_at: string;
  names: ProfileName[];
  flags: ProfileFlag[];
  images: ProfileImage[];
  friends: Friend[];
  links: ProfileLink[];
  custom_fields: CustomField[];
  badges: Badge[];
  is_banned?: boolean;
}

export interface Report {
  id: number;
  reporter_id: number | null;
  reported_user_id: number;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  admin_note: string | null;
  created_at: string;
  reporter_username?: string;
  reported_username?: string;
}

export interface SiteFile {
  id: number;
  filename: string;
  filetype: 'html' | 'css' | 'js';
  content?: string;
  updated_at: string;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  is_banned: number;
  created_at: string;
}
