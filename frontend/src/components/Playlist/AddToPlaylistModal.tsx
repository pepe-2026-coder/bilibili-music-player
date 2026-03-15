import { useState, useEffect } from "react";
import { Modal, List, Button, Space, Typography, Empty, message, Divider } from "antd";
import { PlusOutlined, PlayCircleOutlined, FastForwardOutlined } from "@ant-design/icons";
import { playlistApi, videoApi } from "../../services/api";
import { usePlayerStore } from "../../stores/playerStore";
import type { Playlist, Video, Song } from "../../types";

const { Text } = Typography;

interface AddToPlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  video: Video;
}

export default function AddToPlaylistModal({
  visible,
  onClose,
  video,
}: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const { addToPlaylist, addToNextPlay } = usePlayerStore();

  // 将 Video 转换为 Song
  const convertVideoToSong = async (v: Video): Promise<Song | null> => {
    let cid = v.cid;
    // 如果 cid 为空，先获取视频详情
    if (!cid) {
      try {
        const { data } = await videoApi.getDetail(v.bvid);
        if (data.code === 0 && data.data.pages && data.data.pages.length > 0) {
          cid = String(data.data.pages[0].cid);
        }
      } catch (error) {
        console.error("获取视频详情失败", error);
      }
    }

    if (!cid) {
      return null;
    }

    return {
      id: 0,
      bvid: v.bvid,
      cid: cid,
      title: v.title,
      artist: v.author || "未知",
      duration: 0,
      cover: v.pic,
    };
  };

  const handleAddToPlaylist = async () => {
    const song = await convertVideoToSong(video);
    if (!song) {
      message.error("无法获取视频信息");
      return;
    }
    addToPlaylist(song);
    message.success("已添加到播放列表");
    onClose();
  };

  const handleAddToNextPlay = async () => {
    const song = await convertVideoToSong(video);
    if (!song) {
      message.error("无法获取视频信息");
      return;
    }
    addToNextPlay(song);
    message.success("已添加到下一首");
    onClose();
  };

  useEffect(() => {
    if (visible) {
      fetchPlaylists();
    }
  }, [visible]);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const { data } = await playlistApi.getAll();
      if (data.code === 0) {
        setPlaylists(data.data);
      }
    } catch (error) {
      message.error("获取歌单失败");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (playlistId: number) => {
    setAddingTo(playlistId);
    try {
      // 如果 cid 为空，先获取视频详情
      let cid = video.cid;
      if (!cid) {
        const { data } = await videoApi.getDetail(video.bvid);
        if (data.code === 0 && data.data.pages && data.data.pages.length > 0) {
          cid = String(data.data.pages[0].cid);
        }
      }

      if (!cid) {
        message.error("无法获取视频 CID");
        return;
      }

      const { data } = await playlistApi.addSong(playlistId, {
        bvid: video.bvid,
        cid: cid,
        title: video.title,
        artist: video.author || "未知",
        cover: video.pic,
      });

      if (data.code === 0) {
        message.success("添加成功");
        onClose();
      }
    } catch (error: any) {
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error("添加失败");
      }
    } finally {
      setAddingTo(null);
    }
  };

  return (
    <Modal
      title="添加到"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      {/* 快速操作按钮 */}
      <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={handleAddToPlaylist}
          style={{ width: "100%", height: 40, background: "#fb7299", borderColor: "#fb7299" }}
        >
          添加到播放列表（末尾）
        </Button>
        <Button
          type="primary"
          icon={<FastForwardOutlined />}
          onClick={handleAddToNextPlay}
          style={{ width: "100%", height: 40, background: "#fb7299", borderColor: "#fb7299" }}
        >
          添加到下一首播放
        </Button>
      </Space>

      <Divider style={{ margin: "16px 0" }} />

      <Text strong style={{ display: "block", marginBottom: 12 }}>添加到歌单</Text>
      {playlists.length === 0 ? (
        <Empty description="暂无歌单，请先创建歌单" />
      ) : (
        <List
          loading={loading}
          dataSource={playlists}
          renderItem={(playlist) => (
            <List.Item
              actions={[
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  loading={addingTo === playlist.id}
                  onClick={() => handleAdd(playlist.id)}
                  size="small"
                  style={{ background: "#fb7299", borderColor: "#fb7299" }}
                >
                  添加
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={playlist.name}
                description={
                  <Text type="secondary">{playlist.song_count} 首歌曲</Text>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
}
