export interface User {
  uid: string;
  username: string;
  avatar: string;
}

export interface Video {
  bvid: string;
  title: string;
  description?: string;
  author?: string;
  pic: string;
  duration?: string;
  pubdate?: number;
  view?: number;
  like?: number;
  cid?: string;
}

export interface VideoDetail {
  bvid: string;
  aid: number;
  title: string;
  description: string;
  pic: string;
  author: {
    mid: number;
    name: string;
    face: string;
  };
  duration: number;
  pubdate: number;
  stat: {
    view: number;
    like: number;
    coin: number;
    favorite: number;
    share: number;
  };
  pages: {
    cid: number;
    page: number;
    part: string;
    duration: number;
  }[];
}

export interface StreamInfo {
  audioUrl: string;
  videoUrl: string;
  format: string;
  quality: number;
  timelength: number;
  isVideo?: boolean;
  cacheKey?: string; // 缓存 key，用于统一的缓存文件命名
}

export interface Playlist {
  id: number;
  name: string;
  description: string;
  cover: string;
  created_at: string;
  updated_at: string;
  song_count: number;
}

export interface Song {
  id: number;
  bvid: string;
  cid: string;
  title: string;
  artist: string;
  duration: number;
  cover: string;
  order_index?: number;
}

export interface DownloadTask {
  id: number;
  bvid: string;
  cid: string;
  title: string;
  format: string;
  status: "pending" | "downloading" | "converting" | "completed" | "failed";
  progress: number;
  file_path?: string;
  file_size?: number;
  created_at: string;
  completed_at?: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
