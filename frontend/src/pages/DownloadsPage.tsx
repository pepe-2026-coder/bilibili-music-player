import { useState, useEffect } from "react";
import {
  Button,
  Space,
  Typography,
  Tag,
  Progress,
  message,
  Modal,
  Card,
  List,
  Avatar,
  Divider,
} from "antd";
import "../styles/mobile-downloads.css";
import {
  DownloadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  FileOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { downloadApi } from "../services/api";
import type { DownloadTask } from "../types";

const { Text, Title } = Typography;

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadTask[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDownloads();
    // 定时刷新
    const interval = setInterval(fetchDownloads, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchDownloads = async () => {
    try {
      const { data } = await downloadApi.getList();
      if (data.code === 0) {
        setDownloads(data.data.downloads);
      }
    } catch (error) {
      console.error("获取下载列表失败:", error);
    }
  };

  const handleDownload = (task: DownloadTask) => {
    downloadApi
      .downloadFile(task.id.toString())
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${task.title}.${task.format}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => {
        message.error("下载文件失败");
      });
  };

  const handleDelete = (task: DownloadTask) => {
    Modal.confirm({
      title: "确认删除",
      content: `确定要删除 "${task.title}" 的下载记录吗？`,
      onOk: async () => {
        try {
          await downloadApi.delete(task.id.toString());
          message.success("删除成功");
          fetchDownloads();
        } catch (error) {
          message.error("删除失败");
        }
      },
    });
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { 
      color: string; 
      text: string; 
      icon: React.ReactNode;
      description: string;
    }> = {
      pending: { 
        color: "default", 
        text: "等待中", 
        icon: <ClockCircleOutlined />, 
        description: "任务已在队列中等待处理"
      },
      downloading: { 
        color: "processing", 
        text: "下载中", 
        icon: <SyncOutlined spin />, 
        description: "正在从服务器下载文件"
      },
      converting: { 
        color: "warning", 
        text: "转换中", 
        icon: <SyncOutlined spin />, 
        description: "正在转换音频格式"
      },
      completed: { 
        color: "success", 
        text: "已完成", 
        icon: <CheckCircleOutlined />, 
        description: "下载完成，可随时播放"
      },
      failed: { 
        color: "error", 
        text: "失败", 
        icon: <CloseCircleOutlined />, 
        description: "下载过程出现错误"
      },
    };
    return statusMap[status] || {
      color: "default",
      text: status,
      icon: <FileOutlined />,
      description: "未知状态"
    };
  };

  const getStatusTag = (status: string) => {
    const statusInfo = getStatusInfo(status);
    return (
      <Tag color={statusInfo.color} icon={statusInfo.icon}>
        {statusInfo.text}
      </Tag>
    );
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "-";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  // 移动端友好的下载项卡片组件
  const DownloadItemCard = ({ task }: { task: DownloadTask }) => {
    const statusInfo = getStatusInfo(task.status);
    
    return (
      <Card
        size="small"
        style={{
          marginBottom: 12,
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
        bodyStyle={{ padding: 16 }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {/* 封面图占位 */}
          <Avatar
            size={56}
            icon={<FileOutlined />}
            style={{
              backgroundColor: "#f0f2f5",
              flexShrink: 0,
            }}
          />
          
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* 标题和状态 */}
            <div style={{ marginBottom: 8 }}>
              <Text 
                strong 
                className="download-item-title"
                ellipsis={{ tooltip: task.title }}
              >
                {task.title}
              </Text>
              <Space size={8}>
                <Tag color={statusInfo.color} icon={statusInfo.icon} className="download-status-tag">
                  {statusInfo.text}
                </Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {task.format?.toUpperCase()}
                </Text>
              </Space>
            </div>
            
            {/* 进度条 */}
            <div style={{ marginBottom: 12 }}>
              {task.status === "completed" ? (
                <Text type="success" style={{ fontSize: 14, fontWeight: 500 }}>
                  <CheckCircleOutlined style={{ marginRight: 4 }} />
                  准备就绪
                </Text>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {statusInfo.description}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {task.progress}%
                    </Text>
                  </div>
                  <Progress 
                    percent={task.progress} 
                    size="small" 
                    showInfo={false}
                    strokeColor="#fb7299"
                    className="download-progress"
                  />
                </div>
              )}
            </div>
            
            {/* 文件信息 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                大小: {formatFileSize(task.file_size)}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(task.created_at).toLocaleDateString()}
              </Text>
            </div>
            
            {/* 操作按钮 - 响应式布局 */}
            <div style={{ display: "flex", gap: 8 }}>
              {task.status === "completed" && (
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  size="middle"
                  className="download-action-btn download-primary-btn"
                  onClick={() => handleDownload(task)}
                >
                  下载
                </Button>
              )}
              <Button
                danger
                icon={<DeleteOutlined />}
                size="middle"
                className="download-action-btn download-delete-btn"
                onClick={() => handleDelete(task)}
              >
                删除
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="downloads-page-container">
      {/* 页面头部 - 移动端优化 */}
      <div className="downloads-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Title level={3}>
            下载管理
          </Title>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={fetchDownloads}
            loading={loading}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              border: "1px solid rgba(0,0,0,0.1)",
            }}
          />
        </div>
        
        {/* 统计信息 */}
        <div style={{ display: "flex", gap: 16 }}>
          <Space className="downloads-stats">
            <Text type="secondary">
              总计: {downloads.length} 个任务
            </Text>
            <Divider type="vertical" />
            <Text type="success">
              已完成: {downloads.filter(d => d.status === "completed").length} 个
            </Text>
          </Space>
        </div>
      </div>

      {/* 空状态 */}
      {downloads.length === 0 && !loading && (
        <div className="downloads-empty">
          <FileOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
          <Title level={4} style={{ color: "#718096", marginBottom: 8 }}>
            暂无下载任务
          </Title>
          <Text>
            快去搜索喜欢的音乐并下载吧
          </Text>
        </div>
      )}

      {/* 下载列表 - 移动端优化的卡片布局 */}
      <List
        dataSource={downloads}
        loading={loading}
        renderItem={(item) => <DownloadItemCard task={item} />}
        itemLayout="vertical"
        split={false}
        style={{ background: "transparent" }}
      />
      
      {/* 底部安全区域填充 */}
      <div style={{ height: 20 }} />
      
      <style>{`
        /* 移动端响应式样式 */
        @media (max-width: 768px) {
          .ant-card {
            margin-bottom: 12px !important;
          }
          
          .ant-btn {
            font-size: 14px !important;
            height: 36px !important;
          }
          
          .ant-progress-inner {
            height: 6px !important;
          }
        }
        
        /* 确保在移动设备上有足够的点击区域 */
        .ant-btn {
          min-width: 44px;
          min-height: 44px;
        }
        
        /* 优化触摸反馈 */
        .ant-btn:not(.ant-btn-disabled):active {
          transform: scale(0.96);
          transition: transform 0.1s ease;
        }
      `}</style>
    </div>
  );
}
