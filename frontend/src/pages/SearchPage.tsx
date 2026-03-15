import { useState, useEffect } from "react";
import {
  Input,
  List,
  Card,
  Button,
  Space,
  Typography,
  Image,
  Tag,
  message,
  Spin,
  Empty,
} from "antd";
import {
  SearchOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { searchApi, videoApi, proxyApi } from "../services/api";
import { usePlayerStore } from "../stores/playerStore";
import type { Video } from "../types";
import AddToPlaylistModal from "../components/Playlist/AddToPlaylistModal";
import DownloadModal from "../components/Download/DownloadModal";

const { Search } = Input;
const { Text } = Typography;

export default function SearchPage() {
  const [keyword, setKeyword] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [isRecommend, setIsRecommend] = useState(true); // 是否显示推荐
  const { play } = usePlayerStore();

  // 页面加载时获取推荐音乐
  useEffect(() => {
    fetchRecommend();
  }, []);

  const fetchRecommend = async () => {
    setLoading(true);
    try {
      const { data } = await searchApi.getRecommend();
      if (data.code === 0) {
        setVideos(data.data.videos);
        setIsRecommend(true);
      }
    } catch (error) {
      console.error("获取推荐失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (value: string) => {
    if (!value.trim()) return;

    setLoading(true);
    setIsRecommend(false);
    try {
      const { data } = await searchApi.search(value);
      if (data.code === 0) {
        setVideos(data.data.videos);
      }
    } catch (error) {
      message.error("搜索失败");
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async (video: Video) => {
    setLoading(true);
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

      const song = {
        id: 0, // 临时 ID
        bvid: video.bvid,
        cid: cid,
        title: video.title,
        artist: video.author || "未知",
        duration: 0,
        cover: proxyApi.getImageUrl(video.pic),
      };
      play(song);
    } catch (error) {
      message.error("获取视频信息失败");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPlaylist = (video: Video) => {
    setSelectedVideo(video);
    setPlaylistModalVisible(true);
  };

  const handleDownload = (video: Video) => {
    setSelectedVideo(video);
    setDownloadModalVisible(true);
  };

  const formatDuration = (duration: string) => {
    return duration || "00:00";
  };

  const formatNumber = (num?: number) => {
    if (!num) return "0";
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + "万";
    }
    return num.toString();
  };

  return (
    <div>
      <Search
        placeholder="搜索音乐、歌手..."
        enterButton={
          <>
            <SearchOutlined /> 搜索
          </>
        }
        size="large"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onSearch={handleSearch}
        loading={loading}
        style={{ marginBottom: 24 }}
      />

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <Spin size="large" />
        </div>
      )}

      {!loading && videos.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: "#718096", fontSize: 14 }}>
                输入关键词搜索喜欢的音乐
              </span>
            }
          />
        </div>
      )}

      {!loading && videos.length > 0 && (
        <>
          {isRecommend && (
            <div
              style={{
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Typography.Title
                level={5}
                style={{ margin: 0, color: "#2d3748" }}
              >
                热门推荐
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                B站音乐区热门榜单
              </Typography.Text>
            </div>
          )}
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4 }}
            dataSource={videos}
            renderItem={(video) => (
              <List.Item>
                <Card
                  hoverable
                  cover={
                    <div style={{ position: "relative" }}>
                      <Image
                        alt={video.title}
                        src={proxyApi.getImageUrl(video.pic)}
                        style={{ height: 160, objectFit: "cover" }}
                        preview={false}
                      />
                      <Tag
                        color="rgba(0,0,0,0.7)"
                        style={{ position: "absolute", bottom: 8, right: 8 }}
                      >
                        {formatDuration(video.duration || "")}
                      </Tag>
                    </div>
                  }
                  actions={[
                    <Button
                      type="text"
                      icon={<PlayCircleOutlined />}
                      onClick={() => handlePlay(video)}
                    >
                      播放
                    </Button>,
                    <Button
                      type="text"
                      icon={<PlusOutlined />}
                      onClick={() => handleAddToPlaylist(video)}
                    >
                      添加
                    </Button>,
                    <Button
                      type="text"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownload(video)}
                    >
                      下载
                    </Button>,
                  ]}
                >
                  <Card.Meta
                    title={
                      <Text
                        ellipsis={{ tooltip: video.title }}
                        style={{ width: "100%", display: "block" }}
                      >
                        {video.title}
                      </Text>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Text
                          type="secondary"
                          ellipsis
                          style={{ fontSize: 12 }}
                        >
                          {video.author}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          播放: {formatNumber(video.view)} · 点赞:{" "}
                          {formatNumber(video.like)}
                        </Text>
                      </Space>
                    }
                  />
                </Card>
              </List.Item>
            )}
          />
        </>
      )}

      {selectedVideo && (
        <>
          <AddToPlaylistModal
            visible={playlistModalVisible}
            onClose={() => setPlaylistModalVisible(false)}
            video={selectedVideo}
          />
          <DownloadModal
            visible={downloadModalVisible}
            onClose={() => setDownloadModalVisible(false)}
            video={selectedVideo}
          />
        </>
      )}
    </div>
  );
}
