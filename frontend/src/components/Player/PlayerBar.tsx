import { useState, useEffect, useRef, useMemo } from "react";
import {
  Layout,
  Slider,
  Button,
  Space,
  Typography,
  Image,
  Tooltip,
  Dropdown,
} from "antd";
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  SoundOutlined,
  UnorderedListOutlined,
  SwapOutlined,
  ReloadOutlined,
  AudioMutedOutlined,
  PlusOutlined,
  DownloadOutlined,
  MoreOutlined,
  EllipsisOutlined,
  OrderedListOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import { usePlayerStore } from "../../stores/playerStore";
import { proxyApi } from "../../services/api";
import PlaylistDrawer from "./PlaylistDrawer";
import AddToPlaylistModal from "./AddToPlaylistModal";
import DownloadModal from "./DownloadModal";
import { message } from "antd";

const { Footer } = Layout;
const { Text } = Typography;

export default function PlayerBar() {
  const [playlistVisible, setPlaylistVisible] = useState(false);
  const [addToPlaylistVisible, setAddToPlaylistVisible] = useState(false);
  const [downloadVisible, setDownloadVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    isPlaying,
    currentSong,
    currentTime,
    duration,
    volume,
    playMode,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    setPlayMode,
    currentIndex,
  } = usePlayerStore();

  // 唱片切换动画方向: 'left' = 下一首向左滑, 'right' = 上一首向右滑
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(
    null
  );
  // 当前显示的歌曲封面（用于动画过渡）
  const [displayedCover, setDisplayedCover] = useState<string>(
    currentSong?.cover || ""
  );
  const prevSongRef = useRef<{ cover: string; index: number }>({
    cover: currentSong?.cover || "",
    index: currentIndex,
  });

  // 唱针状态：true = 接触唱片（播放中），false = 离开唱片（暂停/停止）
  const [needleTouching, setNeedleTouching] = useState(false);

  // 唱针角度计算：播放进度 0% = 4deg，100% = 25deg，暂停时 = 45deg
  const needleAngle = useMemo(() => {
    if (!needleTouching) return 45; // 暂停时离开唱片
    if (!duration || duration === 0) return 4; // 无时长时用初始角度
    const progress = Math.min(currentTime / duration, 1); // 限制在 0-1 范围
    return 4 + progress * 21; // 4deg + progress * (25 - 4)
  }, [needleTouching, currentTime, duration]);

  // 监听 currentTime 为 0 时重置唱片角度（停止/新歌曲开始）
  useEffect(() => {
    // 当播放从头开始时，触发CSS动画重置
  }, [currentTime, isPlaying]);

  // 唱针动画逻辑
  useEffect(() => {
    if (isPlaying && currentSong) {
      // 播放时唱针接触唱片
      setNeedleTouching(true);
    } else {
      // 暂停时唱针离开唱片
      setNeedleTouching(false);
    }
  }, [isPlaying, currentSong]);

  // 监听歌曲切换，触发动画
  useEffect(() => {
    if (currentSong?.cover) {
      const prevData = prevSongRef.current;

      // 判断切换方向
      let direction: "left" | "right" = "left";
      if (currentIndex !== undefined && prevData.index !== undefined) {
        if (currentIndex > prevData.index) {
          direction = "left"; // 下一首，向左滑
        } else if (currentIndex < prevData.index) {
          direction = "right"; // 上一首，向右滑
        }
      }

      if (currentSong.cover !== prevData.cover) {
        // 触发滑入动画
        setSlideDirection(direction);
        setDisplayedCover(prevData.cover);

        // 延迟更新为新封面，产生滑入效果
        setTimeout(() => {
          setDisplayedCover(currentSong.cover);
        }, 50);

        // 动画完成后清除方向状态
        setTimeout(() => {
          setSlideDirection(null);
        }, 300);

        prevSongRef.current = { cover: currentSong.cover, index: currentIndex };
      }
    }
  }, [currentSong?.cover, currentIndex]);

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const handleVolumeChange = (value: number) => {
    setVolume(value / 100);
  };

  const handleSeek = (value: number) => {
    seek(value);
  };

  const togglePlayMode = () => {
    const modes: ("order" | "random" | "single")[] = [
      "order",
      "random",
      "single",
    ];
    const currentIndex = modes.indexOf(playMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setPlayMode(nextMode);

    // 切换模式后显示 toast 提示
    const modeMessages: Record<string, string> = {
      order: "已切换为列表循环",
      random: "已切换为随机播放",
      single: "已切换为单曲循环",
    };
    message.info(modeMessages[nextMode]);
  };

  const getPlayModeIcon = () => {
    switch (playMode) {
      case "random":
        return <SwapOutlined />;
      case "single":
        return <ReloadOutlined />;
      default:
        return <OrderedListOutlined />;
    }
  };

  const getPlayModeText = () => {
    switch (playMode) {
      case "random":
        return "随机播放";
      case "single":
        return "单曲循环";
      default:
        return "顺序播放";
    }
  };

  const handleExpand = () => {
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
  };

  // PlayerBar 始终显示，无论是否有歌曲

  return (
    <>
      <Footer
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(0, 0, 0, 0.05)",
          padding: "8px 16px",
          boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.08)",
        }}
        className="player-bar"
      >
        {/* 移动端简化布局 - 增加播放控制按钮 */}
        <div className="mobile-player" style={{ display: "none" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            {currentSong ? (
              <Image
                src={currentSong.cover}
                width={48}
                height={48}
                style={{
                  borderRadius: 8,
                  objectFit: "cover",
                  flexShrink: 0,
                  cursor: "pointer",
                }}
                preview={false}
                onClick={handleExpand}
              />
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  background: "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <PlayCircleOutlined style={{ fontSize: 24, color: "#999" }} />
              </div>
            )}
            <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
              <Text
                strong
                style={{
                  display: "block",
                  fontSize: 14,
                  color: currentSong ? "#2d3748" : "#a0aec0",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {currentSong?.title || "暂无播放内容"}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: currentSong ? "#718096" : "#cbd5e0",
                }}
                ellipsis
              >
                {currentSong?.artist || "请选择歌曲播放"}
              </Text>
            </div>
          </div>

          {/* 播放进度条 */}
          <Slider
            value={currentSong ? currentTime : 0}
            max={currentSong ? duration : 100}
            onChange={handleSeek}
            disabled={!currentSong}
            tooltip={{ formatter: (value) => formatTime(value || 0) }}
            style={{ margin: "0 0 12px 0" }}
            trackStyle={{ background: "#fb7299" }}
            handleStyle={{ borderColor: "#fb7299" }}
          />

          {/* 播放控制按钮 - 对称布局 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: 8,
            }}
          >
            <Button
              type="text"
              icon={getPlayModeIcon()}
              onClick={togglePlayMode}
              style={{ color: "#718096", fontSize: 18 }}
              size="large"
            />

            <Space size="large">
              <Button
                type="text"
                icon={<StepBackwardOutlined />}
                onClick={prev}
                size="large"
                style={{ color: "#4a5568", fontSize: 20 }}
                disabled={!currentSong}
              />
              <Button
                type="primary"
                shape="circle"
                icon={
                  isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />
                }
                onClick={togglePlay}
                size="large"
                style={{
                  background: currentSong ? "#fb7299" : "#cbd5e0",
                  borderColor: currentSong ? "#fb7299" : "#cbd5e0",
                  width: 48,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                disabled={!currentSong}
              />
              <Button
                type="text"
                icon={<StepForwardOutlined />}
                onClick={next}
                size="large"
                style={{ color: "#4a5568", fontSize: 20 }}
                disabled={!currentSong}
              />
            </Space>

            <Dropdown
              menu={{
                items: [
                  {
                    key: "add",
                    icon: <PlusOutlined />,
                    label: "添加到歌单",
                    onClick: () => setAddToPlaylistVisible(true),
                    disabled: !currentSong,
                  },
                  {
                    key: "download",
                    icon: <DownloadOutlined />,
                    label: "下载",
                    onClick: () => setDownloadVisible(true),
                    disabled: !currentSong,
                  },
                  {
                    key: "playlist",
                    icon: <UnorderedListOutlined />,
                    label: "播放列表",
                    onClick: () => setPlaylistVisible(true),
                  },
                ],
              }}
              trigger={["click"]}
              placement="topRight"
            >
              <Button
                type="text"
                icon={<MoreOutlined />}
                style={{
                  color: "#718096",
                  fontSize: 18,
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                size="large"
              />
            </Dropdown>
          </div>
        </div>

        {/* 桌面端完整布局 */}
        <div
          className="desktop-player"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* 歌曲信息 - 根据是否有歌曲条件渲染 */}
          <div
            className="desktop-song-info"
            style={{
              display: "flex",
              alignItems: "center",
              width: 250,
              flexShrink: 0,
            }}
          >
            {currentSong ? (
              <div
                className="desktop-cover-wrapper"
                style={{
                  width: 48,
                  height: 48,
                  flexShrink: 0,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <Image
                  src={currentSong.cover}
                  width={48}
                  height={48}
                  style={{
                    borderRadius: 8,
                    objectFit: "cover",
                    cursor: "pointer",
                  }}
                  preview={false}
                  onClick={handleExpand}
                />
              </div>
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  background: "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <PlayCircleOutlined style={{ fontSize: 24, color: "#999" }} />
              </div>
            )}
            <div style={{ marginLeft: 12, overflow: "hidden" }}>
              <Text
                strong
                style={{
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: currentSong ? "#2d3748" : "#a0aec0",
                }}
              >
                {currentSong?.title || "暂无播放内容"}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: currentSong ? "#718096" : "#cbd5e0",
                }}
              >
                {currentSong?.artist || "请选择歌曲播放"}
              </Text>
            </div>
          </div>

          {/* 播放控制 - 无歌曲时禁用 */}
          <Space direction="vertical" align="center" style={{ flex: 1 }}>
            <Space>
              <Tooltip title={getPlayModeText()}>
                <Button
                  type="text"
                  icon={getPlayModeIcon()}
                  onClick={togglePlayMode}
                  style={{ color: "#718096" }}
                />
              </Tooltip>
              <Button
                type="text"
                icon={<StepBackwardOutlined />}
                onClick={prev}
                size="large"
                style={{ color: "#4a5568" }}
                disabled={!currentSong}
              />
              <Button
                type="primary"
                shape="circle"
                icon={
                  isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />
                }
                onClick={togglePlay}
                size="large"
                style={{
                  background: currentSong ? "#fb7299" : "#cbd5e0",
                  borderColor: currentSong ? "#fb7299" : "#cbd5e0",
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                disabled={!currentSong}
              />
              <Button
                type="text"
                icon={<StepForwardOutlined />}
                onClick={next}
                size="large"
                style={{ color: "#4a5568" }}
                disabled={!currentSong}
              />

              <Dropdown
                menu={{
                  items: [
                    {
                      key: "add",
                      icon: <PlusOutlined />,
                      label: "添加到歌单",
                      onClick: () => setAddToPlaylistVisible(true),
                      disabled: !currentSong,
                    },
                    {
                      key: "download",
                      icon: <DownloadOutlined />,
                      label: "下载",
                      onClick: () => setDownloadVisible(true),
                      disabled: !currentSong,
                    },
                    {
                      key: "playlist",
                      icon: <UnorderedListOutlined />,
                      label: "播放列表",
                      onClick: () => setPlaylistVisible(true),
                    },
                  ],
                }}
                trigger={["hover"]}
                placement="top"
              >
                <Button
                  type="text"
                  icon={<EllipsisOutlined />}
                  style={{
                    color: "#718096",
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
              </Dropdown>
            </Space>
            {/* 进度条 - 使用 div 布局避免 Space 的 flex 问题 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flex: 1,
                minWidth: 300,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: currentSong ? "#718096" : "#cbd5e0",
                  minWidth: 40,
                  textAlign: "center",
                }}
              >
                {formatTime(currentSong ? currentTime : 0)}
              </Text>
              <Slider
                value={currentSong ? currentTime : 0}
                max={currentSong ? duration : 100}
                onChange={handleSeek}
                disabled={!currentSong}
                style={{ flex: 1, margin: "0 8px" }}
                trackStyle={{ background: "#fb7299" }}
                railStyle={{ background: "#e0e0e0" }}
                handleStyle={{ borderColor: "#fb7299" }}
                tooltip={{ formatter: (value) => formatTime(value || 0) }}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: currentSong ? "#718096" : "#cbd5e0",
                  minWidth: 40,
                  textAlign: "center",
                }}
              >
                {formatTime(currentSong ? duration : 0)}
              </Text>
            </div>
          </Space>

          {/* 音量控制 */}
          <Space style={{ width: 150, justifyContent: "flex-end" }}>
            <Button
              type="text"
              icon={volume === 0 ? <AudioMutedOutlined /> : <SoundOutlined />}
              onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
              style={{ color: "#718096" }}
            />
            <Slider
              value={volume * 100}
              onChange={handleVolumeChange}
              style={{ width: 100 }}
              trackStyle={{ background: "rgba(251, 114, 153, 0.6)" }}
              handleStyle={{ borderColor: "#fb7299" }}
            />
          </Space>
        </div>
      </Footer>

      <style>{`
        .player-bar {
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
        
        /* 桌面端歌曲信息区域不被压缩 */
        .desktop-song-info {
          flex-shrink: 0 !important;
          min-width: 250px !important;
        }
        .desktop-cover-wrapper {
          flex-shrink: 0 !important;
          min-width: 48px !important;
          min-height: 48px !important;
        }
        .desktop-cover-wrapper img {
          width: 48px !important;
          height: 48px !important;
          min-width: 48px !important;
          min-height: 48px !important;
        }
        
        @media (max-width: 768px) {
          .mobile-player {
            display: block !important;
          }
          .desktop-player {
            display: none !important;
          }
        }
        @media (min-width: 769px) {
          .mobile-player {
            display: none !important;
          }
          .desktop-player {
            display: flex !important;
          }
        }
      `}</style>

      <PlaylistDrawer
        visible={playlistVisible}
        onClose={() => setPlaylistVisible(false)}
      />

      {currentSong && (
        <>
          <AddToPlaylistModal
            visible={addToPlaylistVisible}
            onClose={() => setAddToPlaylistVisible(false)}
            video={{
              bvid: currentSong.bvid,
              cid: currentSong.cid,
              title: currentSong.title,
              author: currentSong.artist,
              pic: currentSong.cover,
            }}
          />
          <DownloadModal
            visible={downloadVisible}
            onClose={() => setDownloadVisible(false)}
            video={{
              bvid: currentSong.bvid,
              cid: currentSong.cid,
              title: currentSong.title,
              author: currentSong.artist,
              pic: currentSong.cover,
            }}
          />
        </>
      )}

      {/* 展开播放器 - 全屏唱片界面 */}
      <div
        className={`expanded-player ${isExpanded ? "expanded" : ""}`}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "transparent",
          zIndex: 9999,
          transform: isExpanded ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s ease-in-out",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 全屏封面背景底图 */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: currentSong?.cover
              ? `url(${proxyApi.getImageUrl(currentSong.cover)})`
              : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            transition: "background-image 0.5s ease-in-out",
          }}
        />

        {/* 毛玻璃覆盖层 */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(180deg, rgba(15, 15, 20, 0.75) 0%, rgba(10, 10, 15, 0.85) 50%, rgba(5, 5, 10, 0.9) 100%)",
            backdropFilter: "blur(40px) saturate(1.2)",
            WebkitBackdropFilter: "blur(40px) saturate(1.2)",
          }}
        />

        {/* 背景光晕效果 - 增加质感 */}
        <div
          style={{
            position: "absolute",
            top: "-30%",
            left: "-20%",
            width: "60%",
            height: "60%",
            background:
              "radial-gradient(circle, rgba(251,114,153,0.12) 0%, rgba(251,114,153,0.04) 40%, transparent 70%)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "10%",
            right: "-15%",
            width: "50%",
            height: "50%",
            background:
              "radial-gradient(circle, rgba(100,149,237,0.1) 0%, rgba(100,149,237,0.03) 40%, transparent 70%)",
            filter: "blur(35px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-20%",
            left: "20%",
            width: "40%",
            height: "40%",
            background:
              "radial-gradient(circle, rgba(147,112,219,0.08) 0%, rgba(147,112,219,0.02) 40%, transparent 70%)",
            filter: "blur(30px)",
            pointerEvents: "none",
          }}
        />
        {/* 前景内容容器 - 确保在背景层之上 */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden",
          }}
        >
          {/* 顶部栏 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 12px",
              paddingTop: "calc(16px + env(safe-area-inset-top, 0))",
            }}
          >
            <Button
              type="text"
              icon={<ArrowDownOutlined />}
              onClick={handleCollapse}
              style={{ color: "#fff", fontSize: 20 }}
              size="large"
            />
            <Text
              style={{
                color: "#fff",
                fontSize: 16,
                flex: 1,
                textAlign: "center",
                marginRight: 48,
              }}
              ellipsis
            >
              {currentSong?.title}
            </Text>
          </div>

          {/* 封面/唱片旋转动画区域 - 始终显示封面，移除视频流 */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* 唱片容器 */}
            <div
              style={{
                position: "relative",
                width: "80%",
                maxWidth: 320,
                aspectRatio: "1",
              }}
            >
              {/* 滑动动画容器 - 处理左右切换动画 */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  transform:
                    slideDirection === "left"
                      ? "translateX(100%)"
                      : slideDirection === "right"
                      ? "translateX(-100%)"
                      : "translateX(0)",
                  opacity: slideDirection ? 0 : 1,
                  transition: "transform 0.25s ease-out, opacity 0.2s ease-out",
                }}
              >
                {/* 旋转容器 - 封面和唱片一起旋转 */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    animation: "rotate 8s linear infinite",
                    animationPlayState: isPlaying ? "running" : "paused",
                  }}
                >
                  {/* 唱片背景 - 黑胶唱片效果 - 带玻璃拟态边框 */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      background:
                        "linear-gradient(145deg, #1a1a1a 0%, #0d0d0d 50%, #151515 100%)",
                      boxShadow:
                        "0 0 0 2px rgba(255, 255, 255, 0.08), 0 0 0 4px rgba(255, 255, 255, 0.04), 0 8px 32px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.03)",
                      overflow: "hidden",
                    }}
                  >
                    {/* 唱片外圈边缘光泽 */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        background:
                          "conic-gradient(from 0deg, transparent 0deg 30deg, rgba(255,255,255,0.05) 30deg 60deg, transparent 60deg 90deg, rgba(255,255,255,0.03) 90deg 120deg, transparent 120deg 150deg, rgba(255,255,255,0.05) 150deg 180deg, transparent 180deg 210deg, rgba(255,255,255,0.03) 210deg 240deg, transparent 240deg 270deg, rgba(255,255,255,0.05) 270deg 300deg, transparent 300deg 330deg, rgba(255,255,255,0.03) 330deg 360deg)",
                      }}
                    />

                    {/* 唱片表面纹理 - 模拟黑胶凹槽 */}
                    <div
                      style={{
                        position: "absolute",
                        top: "3%",
                        left: "3%",
                        width: "94%",
                        height: "94%",
                        borderRadius: "50%",
                        background:
                          "repeating-radial-gradient(circle at center, transparent 0px, transparent 2px, rgba(30,30,30,0.8) 2px, rgba(30,30,30,0.8) 3px, transparent 3px, transparent 5px)",
                      }}
                    />

                    {/* 唱片外圈深色边缘 - 玻璃拟态层次感 */}
                    <div
                      style={{
                        position: "absolute",
                        top: "1.5%",
                        left: "1.5%",
                        width: "97%",
                        height: "97%",
                        borderRadius: "50%",
                        border: "1px solid rgba(40,40,40,0.8)",
                        boxShadow:
                          "inset 0 0 15px rgba(0,0,0,0.6), inset 0 0 1px rgba(255,255,255,0.1)",
                      }}
                    />

                    {/* 多层同心圆纹路 - 增强对比度 */}
                    {[85, 75, 65, 55, 45].map((size, index) => (
                      <div
                        key={index}
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          width: `${size}%`,
                          height: `${size}%`,
                          borderRadius: "50%",
                          border: `1px solid rgba(${
                            index % 2 === 0 ? "80,80,80" : "50,50,50"
                          }, 0.4)`,
                        }}
                      />
                    ))}

                    {/* 唱片内圈区域 */}
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "38%",
                        height: "38%",
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg, #252525 0%, #151515 50%, #202020 100%)",
                        boxShadow:
                          "inset 0 0 10px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.5), inset 0 0 1px rgba(255,255,255,0.08)",
                      }}
                    >
                      {/* 标签区域 - 粉色品牌色 */}
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          width: "80%",
                          height: "80%",
                          borderRadius: "50%",
                          background:
                            "linear-gradient(135deg, #fb7299 0%, #fc9bb8 40%, #fb7299 100%)",
                          boxShadow:
                            "0 2px 8px rgba(251,114,153,0.4), inset 0 1px 2px rgba(255,255,255,0.3)",
                        }}
                      >
                        {/* 标签中心小孔 - 玻璃质感 */}
                        <div
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: "8%",
                            height: "8%",
                            borderRadius: "50%",
                            background: "#0a0a0a",
                            border: "1px solid rgba(60,60,60,0.8)",
                            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.8)",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 封面图片 - 居中 */}
                  <img
                    src={
                      displayedCover ? proxyApi.getImageUrl(displayedCover) : ""
                    }
                    alt="cover"
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: "55%",
                      aspectRatio: "1",
                      objectFit: "cover",
                      borderRadius: "50%",
                      boxShadow:
                        "0 4px 16px rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.06), inset 0 0 1px rgba(255,255,255,0.1)",
                    }}
                  />
                </div>

                {/* 固定光影效果 - 不随唱片转动 */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    borderRadius: "50%",
                    overflow: "hidden",
                  }}
                >
                  {/* 主高光 - 柔和的椭圆光斑 */}
                  <div
                    style={{
                      position: "absolute",
                      top: "-10%",
                      left: "10%",
                      width: "45%",
                      height: "35%",
                      borderRadius: "50%",
                      background:
                        "radial-gradient(ellipse at center, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.04) 60%, transparent 100%)",
                      filter: "blur(8px)",
                    }}
                  />

                  {/* 次高光 - 边缘光晕 */}
                  <div
                    style={{
                      position: "absolute",
                      top: "5%",
                      left: "5%",
                      width: "30%",
                      height: "20%",
                      borderRadius: "50%",
                      background:
                        "radial-gradient(ellipse at center, rgba(255,255,255,0.15) 0%, transparent 70%)",
                      filter: "blur(12px)",
                    }}
                  />

                  {/* 底部微弱补光 */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "5%",
                      right: "15%",
                      width: "25%",
                      height: "15%",
                      borderRadius: "50%",
                      background:
                        "radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 70%)",
                      filter: "blur(10px)",
                    }}
                  />

                  {/* 边缘光泽 - 模拟唱片边缘的反光 */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      background:
                        "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.05) 100%)",
                    }}
                  />
                </div>

                {/* 播放/暂停指示器 - 不旋转 */}
                {!isPlaying && currentSong && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      zIndex: 2,
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                    onClick={togglePlay}
                  >
                    <PlayCircleOutlined
                      style={{ fontSize: 28, color: "#fff" }}
                    />
                  </div>
                )}

                {/* 唱针组件 - 整体旋转容器 */}
                <div
                  style={{
                    position: "absolute",
                    top: "-10%",
                    right: "2%",
                    width: "50%",
                    height: "60%",
                    zIndex: 10,
                    pointerEvents: "none",
                    transformOrigin: "calc(100% - 24px) 24px", // 以支点圆心为旋转中心
                    transform: `rotate(${needleAngle}deg)`,
                    // 播放时使用线性过渡（跟随进度），暂停/播放切换时使用弹性动画
                    transition: needleTouching
                      ? "transform 0.3s linear"
                      : "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                >
                  {/* 支点底座 - 外圈 */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background:
                        "linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 100%)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                      zIndex: 30,
                    }}
                  >
                    {/* 支点中圈 */}
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background:
                          "linear-gradient(145deg, #4a4a4a 0%, #303030 100%)",
                        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
                      }}
                    >
                      {/* 支点内圈 - 轴承 */}
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background:
                            "linear-gradient(145deg, #606060 0%, #3a3a3a 100%)",
                          boxShadow: "0 1px 2px rgba(255,255,255,0.1)",
                        }}
                      />
                    </div>
                  </div>

                  {/* SVG 弧形摇臂 */}
                  <svg
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      overflow: "visible",
                    }}
                    viewBox="0 0 200 180"
                    preserveAspectRatio="xMaxYMin meet"
                  >
                    <defs>
                      {/* 摇臂金属渐变 */}
                      <linearGradient
                        id="armGradient"
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#d0d0d0" />
                        <stop offset="30%" stopColor="#a8a8a8" />
                        <stop offset="70%" stopColor="#909090" />
                        <stop offset="100%" stopColor="#b8b8b8" />
                      </linearGradient>
                      {/* 唱头渐变 */}
                      <linearGradient
                        id="headGradient"
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#505050" />
                        <stop offset="100%" stopColor="#252525" />
                      </linearGradient>
                    </defs>

                    {/* 摇臂 - 优雅的S形曲线 */}
                    <path
                      d="M 176 24 Q 140 26, 100 50 Q 60 75, 28 110"
                      fill="none"
                      stroke="url(#armGradient)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    {/* 摇臂高光 */}
                    <path
                      d="M 176 23 Q 140 25, 100 49 Q 60 74, 28 109"
                      fill="none"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="1"
                      strokeLinecap="round"
                    />

                    {/* 唱头外壳 */}
                    <rect
                      x="18"
                      y="105"
                      width="16"
                      height="22"
                      rx="2"
                      fill="url(#headGradient)"
                    />
                    {/* 唱头高光 */}
                    <rect
                      x="19"
                      y="106"
                      width="6"
                      height="20"
                      rx="1"
                      fill="rgba(255,255,255,0.08)"
                    />

                    {/* 针尖 */}
                    <path d="M 26 127 L 29 138 L 23 138 Z" fill="#1a1a1a" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 旋转动画关键帧 */}
            <style>{`
            @keyframes rotate {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
          </div>

          {/* 歌曲信息 */}
          <div
            style={{
              padding: "16px 24px",
              paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0))",
            }}
          >
            <Text
              strong
              style={{
                display: "block",
                fontSize: 18,
                color: "#fff",
                marginBottom: 4,
                textAlign: "center",
              }}
              ellipsis
            >
              {currentSong?.title}
            </Text>
            <Text
              style={{
                display: "block",
                fontSize: 14,
                color: "rgba(255,255,255,0.6)",
                marginBottom: 16,
                textAlign: "center",
              }}
              ellipsis
            >
              {currentSong?.artist}
            </Text>

            {/* 进度条 */}
            <Slider
              value={currentTime}
              max={duration}
              onChange={handleSeek}
              tooltip={{ formatter: (value) => formatTime(value || 0) }}
              style={{ margin: "0 0 12px 0" }}
              trackStyle={{ background: "#fb7299" }}
              handleStyle={{ borderColor: "#fb7299" }}
              railStyle={{ background: "rgba(255,255,255,0.2)" }}
            />

            {/* 时间显示 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                {formatTime(currentTime)}
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                {formatTime(duration)}
              </Text>
            </div>

            {/* 播放控制按钮 */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 32,
              }}
            >
              <Button
                type="text"
                icon={getPlayModeIcon()}
                onClick={togglePlayMode}
                style={{ color: "rgba(255,255,255,0.7)", fontSize: 18 }}
                size="large"
              />
              <Button
                type="text"
                icon={<StepBackwardOutlined />}
                onClick={prev}
                size="large"
                style={{ color: "#fff", fontSize: 24 }}
              />
              <Button
                type="primary"
                shape="circle"
                icon={
                  isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />
                }
                onClick={togglePlay}
                size="large"
                style={{
                  background: "#fb7299",
                  borderColor: "#fb7299",
                  width: 64,
                  height: 64,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              />
              <Button
                type="text"
                icon={<StepForwardOutlined />}
                onClick={next}
                size="large"
                style={{ color: "#fff", fontSize: 24 }}
              />
              <Dropdown
                menu={{
                  items: [
                    {
                      key: "add",
                      icon: <PlusOutlined />,
                      label: "添加到歌单",
                      onClick: () => {
                        handleCollapse();
                        setAddToPlaylistVisible(true);
                      },
                    },
                    {
                      key: "download",
                      icon: <DownloadOutlined />,
                      label: "下载",
                      onClick: () => {
                        handleCollapse();
                        setDownloadVisible(true);
                      },
                    },
                    {
                      key: "playlist",
                      icon: <UnorderedListOutlined />,
                      label: "播放列表",
                      onClick: () => {
                        handleCollapse();
                        setPlaylistVisible(true);
                      },
                    },
                  ],
                }}
                trigger={["click"]}
                placement="topRight"
              >
                <Button
                  type="text"
                  icon={<MoreOutlined />}
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 18,
                  }}
                  size="large"
                />
              </Dropdown>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
