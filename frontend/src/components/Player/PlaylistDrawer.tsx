import { Drawer, List, Button, Typography, Empty } from "antd";
import {
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
} from "@ant-design/icons";
import { usePlayerStore } from "../../stores/playerStore";

const { Text } = Typography;

interface PlaylistDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export default function PlaylistDrawer({
  visible,
  onClose,
}: PlaylistDrawerProps) {
  const {
    playlist,
    isPlaying,
    currentIndex,
    play,
    pause,
    removeFromPlaylist,
    clearPlaylist,
  } = usePlayerStore();

  const handlePlay = (index: number) => {
    if (currentIndex === index && isPlaying) {
      pause();
    } else {
      play(playlist[index]);
    }
  };

  return (
    <Drawer
      title=""
      placement="bottom"
      onClose={onClose}
      open={visible}
      height="70vh"
      bodyStyle={{
        padding: 0,
        background: "rgba(255, 255, 255, 0.98)",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
      }}
      headerStyle={{
        display: "none",
        background: "rgba(255, 255, 255, 0.98)",
      }}
      maskStyle={{
        background: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
      }}
      extra={null}
    >
      {/* 顶部拖动手柄 */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "16px 0",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "#d1d5db",
            borderRadius: 2,
          }}
        />
      </div>

      {/* 标题栏 */}
      <div
        style={{
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <Typography.Title level={4} style={{ margin: 0, color: "#2d3748" }}>
          播放列表
        </Typography.Title>
        {playlist.length > 0 && (
          <Button
            danger
            size="small"
            onClick={clearPlaylist}
            icon={<DeleteOutlined />}
          >
            清空
          </Button>
        )}
      </div>
      {playlist.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <Empty
            description="播放列表为空"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      ) : (
        <div
          style={{
            padding: "16px 20px",
            maxHeight: "calc(70vh - 120px)",
            overflowY: "auto",
          }}
        >
          <List
            dataSource={playlist}
            renderItem={(song, index) => (
              <List.Item
                style={{
                  background:
                    currentIndex === index ? "#fff0f3" : "transparent",
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
                actions={[
                  <Button
                    type="text"
                    icon={
                      currentIndex === index && isPlaying ? (
                        <PauseCircleOutlined />
                      ) : (
                        <PlayCircleOutlined />
                      )
                    }
                    onClick={() => handlePlay(index)}
                    style={{ fontSize: 18 }}
                  />,
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeFromPlaylist(index)}
                    style={{ fontSize: 16 }}
                  />,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Text
                      strong={currentIndex === index}
                      style={{
                        fontSize: 15,
                        color: currentIndex === index ? "#fb7299" : "#2d3748",
                      }}
                    >
                      {song.title}
                    </Text>
                  }
                  description={
                    <Text style={{ fontSize: 13, color: "#718096" }}>
                      {song.artist}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )}
    </Drawer>
  );
}
