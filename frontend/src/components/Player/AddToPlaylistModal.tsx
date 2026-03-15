import { useState, useEffect } from "react";
import { Modal, List, Button, message, Typography, Empty } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { playlistApi } from "../../services/api";
import type { Playlist, Video } from "../../types";

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
        // 这里简化处理，实际应用中可能需要调用 API 获取
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
      title="添加到歌单"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
    >
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
