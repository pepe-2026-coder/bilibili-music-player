import { useState, useEffect } from "react";
import {
  Card,
  List,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  message,
  Empty,
  Tabs,
  Image,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import { playlistApi, proxyApi } from "../services/api";
import { usePlayerStore } from "../stores/playerStore";
import MobilePlaylistItem from "../components/Playlist/MobilePlaylistItem";
import type { Playlist, Song } from "../types";

const { Title, Text } = Typography;
const { TabPane } = Tabs;

export default function PlaylistPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    null
  );
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [form] = Form.useForm();
  const { play, setPlaylist } = usePlayerStore();

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      const { data } = await playlistApi.getAll();
      if (data.code === 0) {
        setPlaylists(data.data);
      }
    } catch (error) {
      message.error("获取歌单失败");
    }
  };

  const fetchPlaylistSongs = async (id: number) => {
    setLoading(true);
    try {
      const { data } = await playlistApi.getById(id);
      if (data.code === 0) {
        setSelectedPlaylist(data.data);
        setSongs(data.data.songs);
      }
    } catch (error) {
      message.error("获取歌单详情失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: {
    name: string;
    description?: string;
  }) => {
    try {
      const { data } = await playlistApi.create(values);
      if (data.code === 0) {
        message.success("创建成功");
        setCreateModalVisible(false);
        form.resetFields();
        fetchPlaylists();
      }
    } catch (error) {
      message.error("创建失败");
    }
  };

  const handleEdit = async (values: { name: string; description?: string }) => {
    if (!selectedPlaylist) return;
    try {
      const { data } = await playlistApi.update(selectedPlaylist.id, values);
      if (data.code === 0) {
        message.success("更新成功");
        setEditModalVisible(false);
        fetchPlaylists();
        fetchPlaylistSongs(selectedPlaylist.id);
      }
    } catch (error) {
      message.error("更新失败");
    }
  };

  const handleDelete = (playlist: Playlist) => {
    Modal.confirm({
      title: "确认删除",
      content: `确定要删除歌单 "${playlist.name}" 吗？`,
      onOk: async () => {
        try {
          await playlistApi.delete(playlist.id);
          message.success("删除成功");
          fetchPlaylists();
          if (selectedPlaylist?.id === playlist.id) {
            setSelectedPlaylist(null);
            setSongs([]);
          }
        } catch (error) {
          message.error("删除失败");
        }
      },
    });
  };

  const handleRemoveSong = async (songId: number) => {
    if (!selectedPlaylist) return;
    try {
      await playlistApi.removeSong(selectedPlaylist.id, songId);
      message.success("移除成功");
      fetchPlaylistSongs(selectedPlaylist.id);
    } catch (error) {
      message.error("移除失败");
    }
  };

  const handlePlayAll = () => {
    if (songs.length > 0) {
      // 处理所有歌曲的封面 URL
      const songsWithProcessedCover = songs.map((song) => ({
        ...song,
        cover: proxyApi.getImageUrl(song.cover),
      }));
      setPlaylist(songsWithProcessedCover, 0);
      play(songsWithProcessedCover[0]);
    }
  };

  const handlePlaySong = (song: Song, index: number) => {
    // 如果是从歌单播放，设置整个歌单为播放队列
    setPlaylist(songs, index);
    play({
      ...song,
      cover: proxyApi.getImageUrl(song.cover),
    });
  };

  const isMobile = () => {
    return window.innerWidth <= 768;
  };

  return (
    <div>
      <Tabs defaultActiveKey="list">
        <TabPane tab="歌单列表" key="list">
          <div style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
              style={{ background: "#fb7299", borderColor: "#fb7299" }}
            >
              新建歌单
            </Button>
          </div>

          {playlists.length === 0 ? (
            <Empty description="暂无歌单，创建一个吧" />
          ) : (
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4 }}
              dataSource={playlists}
              renderItem={(playlist) => (
                <List.Item>
                  <Card
                    hoverable
                    onClick={() => fetchPlaylistSongs(playlist.id)}
                    style={{
                      borderColor:
                        selectedPlaylist?.id === playlist.id
                          ? "#fb7299"
                          : undefined,
                    }}
                    cover={
                      playlist.cover ? (
                        <Image
                          src={proxyApi.getImageUrl(playlist.cover)}
                          height={160}
                          style={{ objectFit: "cover" }}
                          preview={false}
                        />
                      ) : null
                    }
                  >
                    <Card.Meta
                      title={playlist.name}
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary" ellipsis>
                            {playlist.description || "暂无描述"}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {playlist.song_count} 首歌曲
                          </Text>
                        </Space>
                      }
                    />
                  </Card>
                </List.Item>
              )}
            />
          )}
        </TabPane>

        {selectedPlaylist && (
          <TabPane tab={selectedPlaylist.name} key="detail">
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handlePlayAll}
                  disabled={songs.length === 0}
                  style={{ background: "#fb7299", borderColor: "#fb7299" }}
                >
                  播放全部
                </Button>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => {
                    form.setFieldsValue({
                      name: selectedPlaylist.name,
                      description: selectedPlaylist.description,
                    });
                    setEditModalVisible(true);
                  }}
                >
                  编辑
                </Button>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(selectedPlaylist)}
                >
                  删除
                </Button>
              </Space>
            </div>

            {songs.length === 0 ? (
              <Empty description="歌单为空，去搜索添加歌曲吧" />
            ) : isMobile() ? (
              // 移动端优化布局
              <div className="mobile-playlist-container">
                {songs.map((song, index) => (
                  <MobilePlaylistItem
                    key={song.id}
                    song={song}
                    index={index}
                    onPlay={handlePlaySong}
                    onRemove={handleRemoveSong}
                  />
                ))}
                <style>{`
                  .mobile-playlist-container {
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                  }
                `}</style>
              </div>
            ) : (
              // 桌面端原有布局
              <List
                dataSource={songs}
                renderItem={(song, index) => (
                  <List.Item
                    actions={[
                      <Button
                        type="text"
                        icon={<PlayCircleOutlined />}
                        onClick={() => {
                          // 如果是从歌单播放，设置整个歌单为播放队列
                          setPlaylist(songs, index);
                          play({
                            ...song,
                            cover: proxyApi.getImageUrl(song.cover),
                          });
                        }}
                      >
                        播放
                      </Button>,
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveSong(song.id)}
                      >
                        移除
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        song.cover ? (
                          <Image
                            src={proxyApi.getImageUrl(song.cover)}
                            width={60}
                            height={60}
                            style={{ borderRadius: 4, objectFit: "cover" }}
                            preview={false}
                            fallback="/favicon.svg"
                          />
                        ) : (
                          <Image
                            src="/favicon.svg"
                            width={60}
                            height={60}
                            style={{ borderRadius: 4, objectFit: "cover" }}
                            preview={false}
                          />
                        )
                      }
                      title={song.title}
                      description={song.artist}
                    />
                  </List.Item>
                )}
              />
            )}
          </TabPane>
        )}
      </Tabs>

      {/* 创建歌单弹窗 */}
      <Modal
        title="新建歌单"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item
            name="name"
            label="歌单名称"
            rules={[{ required: true, message: "请输入歌单名称" }]}
          >
            <Input placeholder="请输入歌单名称" />
          </Form.Item>
          <Form.Item name="description" label="歌单描述">
            <Input.TextArea placeholder="请输入歌单描述（可选）" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑歌单弹窗 */}
      <Modal
        title="编辑歌单"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleEdit} layout="vertical">
          <Form.Item
            name="name"
            label="歌单名称"
            rules={[{ required: true, message: "请输入歌单名称" }]}
          >
            <Input placeholder="请输入歌单名称" />
          </Form.Item>
          <Form.Item name="description" label="歌单描述">
            <Input.TextArea placeholder="请输入歌单描述（可选）" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
