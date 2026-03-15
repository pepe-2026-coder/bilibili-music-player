import { Button, Typography, Image } from "antd";
import { PlayCircleOutlined, DeleteOutlined } from "@ant-design/icons";
import { proxyApi } from "../../services/api";
import type { Song } from "../../types";

const { Text } = Typography;

interface MobilePlaylistItemProps {
  song: Song;
  index: number;
  onPlay: (song: Song, index: number) => void;
  onRemove: (songId: number) => void;
}

export default function MobilePlaylistItem({
  song,
  index,
  onPlay,
  onRemove,
}: MobilePlaylistItemProps) {
  return (
    <div className="compact-mobile-item">
      {/* 左侧封面和信息 */}
      <div className="item-main" onClick={() => onPlay(song, index)}>
        <div className="item-cover">
          {song.cover ? (
            <Image
              src={proxyApi.getImageUrl(song.cover)}
              width={48}
              height={48}
              style={{
                borderRadius: 6,
                objectFit: "cover",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
              preview={false}
              fallback="/favicon.svg"
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 6,
                backgroundColor: "#f5f5f5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <PlayCircleOutlined style={{ fontSize: 16, color: "#ccc" }} />
            </div>
          )}
        </div>

        <div className="item-info">
          <Text className="item-title" ellipsis={{ rows: 1 }}>
            {song.title}
          </Text>
          <Text type="secondary" className="item-artist" ellipsis={{ rows: 1 }}>
            {song.artist}
          </Text>
        </div>
      </div>

      {/* 右侧操作按钮 */}
      <div className="item-actions">
        <Button
          type="text"
          icon={<PlayCircleOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onPlay(song, index);
          }}
          size="small"
          className="action-btn play-btn"
        />
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(song.id);
          }}
          size="small"
          className="action-btn remove-btn"
        />
      </div>

      <style>{`
        .compact-mobile-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          transition: background-color 0.2s ease;
          min-height: 64px;
        }
        
        .compact-mobile-item:hover {
          background-color: rgba(251, 114, 153, 0.05);
        }
        
        .compact-mobile-item:last-child {
          border-bottom: none;
        }
        
        .item-main {
          display: flex;
          align-items: center;
          flex: 1;
          min-width: 0;
          cursor: pointer;
        }
        
        .item-cover {
          margin-right: 10px;
          flex-shrink: 0;
        }
        
        .item-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        
        .item-title {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          margin-bottom: 2px;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.3;
        }
        
        .item-artist {
          font-size: 12px;
          color: #888;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }
        
        .item-actions {
          display: flex;
          gap: 4px;
          margin-left: 8px;
          flex-shrink: 0;
        }
        
        .action-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        
        .play-btn {
          color: #fb7299;
        }
        
        .play-btn:hover {
          background-color: rgba(251, 114, 153, 0.1);
        }
        
        .remove-btn {
          color: #ff4d4f;
        }
        
        .remove-btn:hover {
          background-color: rgba(255, 77, 79, 0.1);
        }
        
        /* 响应式调整 */
        @media (max-width: 480px) {
          .compact-mobile-item {
            padding: 6px 10px;
            min-height: 60px;
          }
          
          .item-cover {
            margin-right: 8px;
          }
          
          .item-title {
            font-size: 13px;
          }
          
          .item-artist {
            font-size: 11px;
          }
          
          .item-actions {
            margin-left: 6px;
          }
        }
      `}</style>
    </div>
  );
}
