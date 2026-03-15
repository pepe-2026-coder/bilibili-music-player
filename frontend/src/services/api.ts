import axios from "axios";
import type {
  ApiResponse,
  User,
  Video,
  VideoDetail,
  StreamInfo,
  Playlist,
  Song,
  DownloadTask,
} from "../types";

const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 认证相关
export const authApi = {
  getQrcode: () =>
    api.get<ApiResponse<{ sessionId: string; url: string }>>("/auth/qrcode"),
  pollLoginStatus: (sessionId: string) =>
    api.get<ApiResponse<{ status: string; credentials?: any }>>(
      `/auth/qrcode/poll?sessionId=${sessionId}`
    ),
  // APP授权登录
  getAppQrcode: () =>
    api.get<
      ApiResponse<{
        sessionId: string;
        key: string;
        authUrl: string;
        appAuthUrl: string;
        qrcodeUrl: string;
      }>
    >("/auth/app-qrcode"),
  pollAppLoginStatus: (sessionId: string) =>
    api.get<ApiResponse<{ status: string; credentials?: any }>>(
      `/auth/app-qrcode/poll?sessionId=${sessionId}`
    ),
  getLoginStatus: () =>
    api.get<ApiResponse<{ isLoggedIn: boolean; user?: User }>>("/auth/status"),
  logout: () => api.post<ApiResponse<null>>("/auth/logout"),
};

// 搜索相关
export const searchApi = {
  search: (keyword: string, page = 1, pageSize = 20) =>
    api.get<
      ApiResponse<{
        videos: Video[];
        total: number;
        page: number;
        pageSize: number;
      }>
    >(
      `/search?keyword=${encodeURIComponent(
        keyword
      )}&page=${page}&pageSize=${pageSize}`
    ),
  getDetail: (bvid: string) =>
    api.get<ApiResponse<VideoDetail>>(`/search/detail/${bvid}`),
  getRecommend: (page = 1, pageSize = 20) =>
    api.get<
      ApiResponse<{
        videos: Video[];
        total: number;
        page: number;
        pageSize: number;
      }>
    >(`/search/recommend?page=${page}&pageSize=${pageSize}`),
};

// 视频相关
export const videoApi = {
  getStream: (bvid: string, cid: string) =>
    api.get<ApiResponse<StreamInfo>>(`/video/${bvid}/stream?cid=${cid}`),
  getDetail: (bvid: string) =>
    api.get<ApiResponse<VideoDetail>>(`/search/detail/${bvid}`),
};

// 歌单相关
export const playlistApi = {
  getAll: () => api.get<ApiResponse<Playlist[]>>("/playlist"),
  getById: (id: number) =>
    api.get<ApiResponse<Playlist & { songs: Song[] }>>(`/playlist/${id}`),
  create: (data: { name: string; description?: string; cover?: string }) =>
    api.post<ApiResponse<Playlist>>("/playlist", data),
  update: (
    id: number,
    data: { name?: string; description?: string; cover?: string }
  ) => api.put<ApiResponse<Playlist>>(`/playlist/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse<null>>(`/playlist/${id}`),
  addSong: (
    id: number,
    data: {
      bvid: string;
      cid?: string;
      title: string;
      artist?: string;
      duration?: number;
      cover?: string;
    }
  ) => api.post<ApiResponse<Song>>(`/playlist/${id}/songs`, data),
  removeSong: (id: number, songId: number) =>
    api.delete<ApiResponse<null>>(`/playlist/${id}/songs/${songId}`),
};

// 下载相关
export const downloadApi = {
  create: (data: {
    bvid: string;
    cid: string;
    title: string;
    format?: string;
  }) => api.post<ApiResponse<{ downloadId: string }>>("/download", data),
  getStatus: (id: string) =>
    api.get<ApiResponse<DownloadTask>>(`/download/${id}`),
  getList: (page = 1, pageSize = 20) =>
    api.get<ApiResponse<{ downloads: DownloadTask[]; total: number }>>(
      `/download?page=${page}&pageSize=${pageSize}`
    ),
  downloadFile: (id: string) =>
    api.get(`/download/${id}/file`, { responseType: "blob" }),
  delete: (id: string) => api.delete<ApiResponse<null>>(`/download/${id}`),
};

// 代理相关（图片和媒体流）
export const proxyApi = {
  // 获取代理后的图片 URL
  getImageUrl: (url: string) => {
    // 如果已经是代理 URL，直接返回
    if (url.startsWith("/api/proxy/image")) {
      return url;
    }
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  },
  // 获取代理后的媒体流 URL（使用完整 URL）
  getMediaUrl: (url: string, type: "audio" | "video" = "audio") =>
    `/api/proxy/media?url=${encodeURIComponent(url)}&type=${type}`,
  // 获取代理后的媒体流 URL（使用 cacheKey，避免相同歌曲生成多个缓存）
  getMediaUrlWithCacheKey: (
    cacheKey: string,
    type: "audio" | "video" = "audio"
  ) => `/api/proxy/media?url=${encodeURIComponent(cacheKey)}&type=${type}`,
};

export default api;
