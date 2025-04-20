export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  views_count?: number;
  favorites_count?: number;
  watchlist_count?: number;
  created_at?: string;
  updated_at?: string;
  settings?: UserSettings;
  viewing_history?: ViewingHistory[];
  favorites?: Favorites[];
  watchlist?: Watchlist[];
}

export interface UserSettings {
  id: number;
  user_id: number;
  notification_email: boolean;
  notification_web: boolean;
  privacy_profile: boolean;
  theme: string;
  language: string;
}

export interface ViewingHistory {
  id: number;
  user_id: number;
  media_id: number;
  created_at: string;
}

export interface Favorites {
  id: number;
  user_id: number;
  media_id: number;
  created_at: string;
}

export interface Watchlist {
  id: number;
  user_id: number;
  media_id: number;
  created_at: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar_id?: string;
  views_count?: number;
  favorites_count?: number;
  watchlist_count?: number;
  created_at?: string;
  updated_at?: string;
}