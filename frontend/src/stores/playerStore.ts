import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Song, StreamInfo } from "../types";
import { videoApi, proxyApi } from "../services/api";

// 简单的 MD5 哈希函数（用于生成缓存文件名）
const md5 = (str: string): string => {
  // 使用简单的哈希算法（实际项目中可以使用第三方库如 crypto-js）
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(32, "0");
};

interface PlayerState {
  // 播放状态
  isPlaying: boolean;
  currentSong: Song | null;
  currentTime: number;
  duration: number;
  volume: number;
  playMode: "order" | "random" | "single";

  // 播放队列
  playlist: Song[];
  currentIndex: number;

  // 音频元素
  audioElement: HTMLAudioElement | null;
  streamInfo: StreamInfo | null;

  // 加载状态
  isLoading: boolean;
  error: string | null;

  // Actions
  initAudio: () => void;
  restoreState: () => void;
  play: (song?: Song) => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlayMode: (mode: "order" | "random" | "single") => void;
  next: () => void;
  prev: () => void;
  setPlaylist: (songs: Song[], startIndex?: number) => void;
  addToPlaylist: (song: Song) => void;
  addToNextPlay: (song: Song) => void;
  removeFromPlaylist: (index: number) => void;
  clearPlaylist: () => void;
}

// 更新MediaSession（锁屏显示和播放控制）
const updateMediaSession = (
  song: Song | null,
  isPlaying: boolean,
  duration: number
) => {
  if (!("mediaSession" in navigator)) return;

  const mediaSession = navigator.mediaSession!;

  if (song) {
    // 设置播放信息
    mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist || "未知艺术家",
      album: "Bilibili Music Player",
      artwork: song.cover
        ? [{ src: song.cover, sizes: "512x512", type: "image/png" }]
        : [],
    });
  }

  // 更新播放状态
  mediaSession.setActionHandler("play", () => {
    usePlayerStore.getState().play();
  });
  mediaSession.setActionHandler("pause", () => {
    usePlayerStore.getState().pause();
  });
  mediaSession.setActionHandler("previoustrack", () => {
    usePlayerStore.getState().prev();
  });
  mediaSession.setActionHandler("nexttrack", () => {
    usePlayerStore.getState().next();
  });
  mediaSession.setActionHandler("seekto", (details) => {
    if (details.seekTime !== undefined) {
      usePlayerStore.getState().seek(details.seekTime);
    }
  });
};

// 预缓存播放列表中的后续歌曲
const preCachePlaylist = async (playlist: Song[], currentIndex: number) => {
  // 预缓存后续3首歌曲
  const preCacheCount = 3;

  for (let i = 1; i <= preCacheCount; i++) {
    const nextIndex = currentIndex + i;
    if (nextIndex >= playlist.length) break;

    const song = playlist[nextIndex];
    if (!song) continue;

    const cacheKey = `${song.bvid}|${song.cid}`;
    const checkCacheUrl = `/api/proxy/media?url=${encodeURIComponent(
      cacheKey
    )}&type=audio&check=1`;

    try {
      const response = await fetch(checkCacheUrl, { method: "HEAD" });
      if (!response.ok) {
        // 缓存不存在，触发预缓存（使用不阻塞的方式）
        const cacheUrl = `/api/proxy/media?url=${encodeURIComponent(
          cacheKey
        )}&type=audio`;
        // 使用 fetch 不等待响应，这样可以在后台缓存
        fetch(cacheUrl, { mode: "no-cors" }).catch(() => {});
        console.log(`📥 开始预缓存: ${song.title}`);
      }
    } catch (error) {
      // 忽略预缓存错误
    }
  }
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      isPlaying: false,
      currentSong: null,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      playMode: "order",
      playlist: [],
      currentIndex: -1,
      audioElement: null,
      streamInfo: null,
      isLoading: false,
      error: null,

      initAudio: () => {
        const audio = new Audio();

        audio.addEventListener("timeupdate", () => {
          set({ currentTime: audio.currentTime });
        });

        audio.addEventListener("loadedmetadata", () => {
          set({ duration: audio.duration });
        });

        audio.addEventListener("ended", () => {
          const { playMode } = get();
          if (playMode === "single") {
            audio.currentTime = 0;
            audio.play();
          } else {
            get().next();
          }
        });

        audio.addEventListener("error", (e) => {
          console.error("音频播放错误:", e);
          set({ error: "音频播放失败", isLoading: false });
        });

        set({ audioElement: audio });
      },

      restoreState: () => {
        const { playlist, currentIndex, currentSong, audioElement } = get();
        // 页面刷新后，恢复播放状态但保持暂停和进度为0
        if (
          playlist.length > 0 &&
          currentIndex >= 0 &&
          currentSong &&
          audioElement
        ) {
          // 设置当前歌曲信息，但进度为0，保持暂停状态
          set({
            currentTime: 0,
            isPlaying: false,
          });
          console.log(
            "✅ 已恢复播放状态:",
            currentSong.title,
            "- 暂停中，进度为0"
          );
        }
      },

      play: async (song?: Song) => {
        const { audioElement, playlist, currentIndex, currentSong } = get();
        if (!audioElement) return;

        const targetSong =
          song || (currentIndex >= 0 ? playlist[currentIndex] : null);
        if (!targetSong) return;

        // 记录播放前的索引，用于预缓存
        let playIndex = currentIndex;
        if (song) {
          const idx = playlist.findIndex((s) => s.bvid === song.bvid);
          playIndex = idx >= 0 ? idx : currentIndex;
        } else if (currentIndex < 0 && playlist.length > 0) {
          playIndex = 0;
        }

        // 判断是否需要重新加载音频源：
        // 1. 传入了新歌曲参数
        // 2. 没有传入歌曲参数，但当前没有加载过音频（audioElement.src 为空）
        const isNewSong = song && song.bvid !== currentSong?.bvid;
        const needsReload = isNewSong || (!song && !audioElement.src);

        // 如果是新歌曲（不在播放队列中），先添加到播放队列
        if (song && !playlist.some((s) => s.bvid === song.bvid)) {
          // 处理歌曲封面 URL，确保经过代理
          const processedSong = {
            ...song,
            cover:
              song.cover && !song.cover.includes("/api/proxy/")
                ? `/api/proxy/image?url=${encodeURIComponent(song.cover)}`
                : song.cover,
          };
          const newPlaylist = [...playlist, processedSong];
          const newIndex = newPlaylist.length - 1;
          set({
            playlist: newPlaylist,
            currentIndex: newIndex,
          });
        }

        // 如果需要加载新的音频源
        if (needsReload) {
          set({ isLoading: true, error: null });

          try {
            let audioSrc: string | undefined;
            const cacheKey = `${targetSong.bvid}|${targetSong.cid}`;

            // 先检查代理缓存（cache/media 目录）
            const checkCacheUrl = `/api/proxy/media?url=${encodeURIComponent(
              cacheKey
            )}&type=audio&check=1`;

            try {
              const cacheResponse = await fetch(checkCacheUrl, {
                method: "HEAD",
              });

              if (cacheResponse.ok) {
                // 缓存存在，直接使用缓存文件
                audioSrc = `/api/proxy/media?url=${encodeURIComponent(
                  cacheKey
                )}&type=audio`;
                console.log("✅ 使用本地缓存:", targetSong.title);
                audioElement.src = audioSrc;
                set({
                  currentSong: targetSong,
                });

                // 缓存存在时也需要获取视频流信息
                const streamData = await videoApi.getStream(
                  targetSong.bvid,
                  targetSong.cid
                );
                if (streamData.data.code === 0 && streamData.data.data) {
                  set({ streamInfo: streamData.data.data });
                }

                if (song) {
                  const index = playlist.findIndex((s) => s.bvid === song.bvid);
                  set({ currentIndex: index >= 0 ? index : currentIndex });
                }
                // 不 return，继续执行后面的播放逻辑
              }
              // 如果缓存不存在，audioSrc 为 undefined，会继续执行下面的远程流请求
            } catch (error) {
              console.warn("检查缓存失败，使用远程流:", error);
            }

            // 没有缓存，获取远程音频流
            if (!audioSrc) {
              const streamData = await videoApi.getStream(
                targetSong.bvid,
                targetSong.cid
              );

              if (streamData.data.code === 0 && streamData.data.data.audioUrl) {
                // 使用 cacheKey 作为统一的缓存标识（避免相同歌曲生成多个缓存文件）
                const key = streamData.data.data.cacheKey || cacheKey;
                audioSrc = proxyApi.getMediaUrlWithCacheKey(key, "audio");
                console.log("📡 使用远程音频流:", targetSong.title);

                // 保存 streamInfo（包含视频 URL）
                set({
                  currentSong: targetSong,
                  streamInfo: streamData.data.data,
                });
              } else {
                set({ error: "无法获取音频流", isLoading: false });
                return;
              }

              audioElement.src = audioSrc;

              // 如果是从播放队列中选择，更新当前索引
              if (song) {
                const index = playlist.findIndex((s) => s.bvid === song.bvid);
                set({ currentIndex: index >= 0 ? index : currentIndex });
              }
            }
          } catch (error) {
            console.error("获取音频流失败:", error);
            set({ error: "获取音频流失败", isLoading: false });
            return;
          }
        } else {
          // 继续播放（暂停后恢复）或切换到同一首歌，只需更新 currentSong 状态
          if (currentSong?.bvid !== targetSong.bvid) {
            set({ currentSong: targetSong });
          }
        }

        audioElement
          .play()
          .then(() => {
            set({ isPlaying: true, isLoading: false });
            // 更新MediaSession（锁屏显示）
            const { currentSong, duration } = get();
            updateMediaSession(currentSong, true, duration);
            // 播放成功后，预缓存后续歌曲
            preCachePlaylist(playlist, playIndex);
          })
          .catch((err) => {
            console.error("播放失败:", err);
            set({ error: "播放失败", isLoading: false });
          });
      },

      pause: () => {
        const { audioElement, currentSong, duration } = get();
        if (audioElement) {
          audioElement.pause();
          set({ isPlaying: false });
          // 更新MediaSession（锁屏显示）
          updateMediaSession(currentSong, false, duration);
        }
      },

      togglePlay: () => {
        const { isPlaying, play, pause } = get();
        if (isPlaying) {
          pause();
        } else {
          play();
        }
      },

      seek: (time: number) => {
        const { audioElement } = get();
        if (audioElement) {
          audioElement.currentTime = time;
          set({ currentTime: time });
        }
      },

      setVolume: (volume: number) => {
        const { audioElement } = get();
        if (audioElement) {
          audioElement.volume = volume;
          set({ volume });
        }
      },

      setPlayMode: (mode) => {
        set({ playMode: mode });
      },

      next: () => {
        const { playlist, currentIndex, playMode, play } = get();
        if (playlist.length === 0) return;

        let nextIndex: number;

        if (playMode === "random") {
          nextIndex = Math.floor(Math.random() * playlist.length);
        } else {
          nextIndex = (currentIndex + 1) % playlist.length;
        }

        set({ currentIndex: nextIndex });
        play(playlist[nextIndex]);
      },

      prev: () => {
        const { playlist, currentIndex, playMode, play } = get();
        if (playlist.length === 0) return;

        let prevIndex: number;

        if (playMode === "random") {
          prevIndex = Math.floor(Math.random() * playlist.length);
        } else {
          prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        }

        set({ currentIndex: prevIndex });
        play(playlist[prevIndex]);
      },

      setPlaylist: (songs, startIndex = 0) => {
        set({
          playlist: songs,
          currentIndex:
            startIndex >= 0 && startIndex < songs.length ? startIndex : -1,
        });
      },

      addToPlaylist: (song) => {
        const { playlist, currentIndex, currentSong } = get();
        // 检查是否已存在
        const existingIndex = playlist.findIndex((s) => s.bvid === song.bvid);

        // 处理歌曲封面 URL，确保经过代理
        const processedSong = {
          ...song,
          cover:
            song.cover && !song.cover.includes("/api/proxy/")
              ? `/api/proxy/image?url=${encodeURIComponent(song.cover)}`
              : song.cover,
        };

        if (existingIndex >= 0) {
          // 如果已存在，直接设置为当前播放
          set({ currentIndex: existingIndex });
        } else {
          // 如果不存在，添加到播放列表末尾
          const newPlaylist = [...playlist, processedSong];
          // 如果当前没有播放歌曲，设置这个为新歌曲
          const newCurrentIndex = !currentSong ? playlist.length : currentIndex;
          set({
            playlist: newPlaylist,
            currentIndex: newCurrentIndex,
          });
        }
      },

      addToNextPlay: (song) => {
        const { playlist, currentIndex, currentSong } = get();
        // 检查是否已存在
        const existingIndex = playlist.findIndex((s) => s.bvid === song.bvid);

        // 处理歌曲封面 URL，确保经过代理
        const processedSong = {
          ...song,
          cover:
            song.cover && !song.cover.includes("/api/proxy/")
              ? `/api/proxy/image?url=${encodeURIComponent(song.cover)}`
              : song.cover,
        };

        if (existingIndex >= 0) {
          // 如果已存在，移动到当前播放歌曲的下一个位置
          const newPlaylist = playlist.filter((_, i) => i !== existingIndex);
          const insertIndex = currentIndex + 1;
          newPlaylist.splice(insertIndex, 0, processedSong);
          set({ playlist: newPlaylist });
        } else {
          // 如果不存在，插入到当前播放歌曲的下一个位置
          // 如果当前没有播放歌曲，插入到播放列表开头
          const insertIndex = currentSong ? currentIndex + 1 : 0;
          const newPlaylist = [...playlist];
          newPlaylist.splice(insertIndex, 0, processedSong);
          set({ playlist: newPlaylist });
        }
      },

      removeFromPlaylist: (index) => {
        const { playlist, currentIndex } = get();
        const newPlaylist = playlist.filter((_, i) => i !== index);

        let newIndex = currentIndex;
        if (index === currentIndex) {
          // 如果删除的是当前播放的歌曲
          newIndex = -1;
          get().pause();
        } else if (index < currentIndex) {
          newIndex = currentIndex - 1;
        }

        set({ playlist: newPlaylist, currentIndex: newIndex });
      },

      clearPlaylist: () => {
        get().pause();
        set({ playlist: [], currentIndex: -1, currentSong: null });
      },
    }),
    {
      name: "music-player-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        playlist: state.playlist,
        currentIndex: state.currentIndex,
        currentSong: state.currentSong,
        playMode: state.playMode,
        volume: state.volume,
      }),
    }
  )
);
