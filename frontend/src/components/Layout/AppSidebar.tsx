import { Layout, Menu, Drawer, Button, Typography } from "antd";
import {
  HomeOutlined,
  SearchOutlined,
  UnorderedListOutlined,
  DownloadOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import { useState } from "react";

const { Sider } = Layout;

interface AppSidebarProps {
  onMenuSelect?: (key: string) => void;
  currentPage?: string;
}

export default function AppSidebar({
  onMenuSelect,
  currentPage = "search",
}: AppSidebarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { key: "search", icon: <SearchOutlined />, label: "搜索" },
    { key: "playlists", icon: <UnorderedListOutlined />, label: "我的歌单" },
    { key: "downloads", icon: <DownloadOutlined />, label: "下载管理" },
  ];

  const handleMenuClick = (key: string) => {
    onMenuSelect?.(key);
    setMobileMenuOpen(false);
  };

  // 移动端菜单按钮 - 移到左上角，避免阻挡播放控制区域
  const MobileMenuButton = () => (
    <Button
      type="text"
      icon={<MenuOutlined />}
      onClick={() => setMobileMenuOpen(true)}
      style={{
        position: "fixed",
        top: 16,
        left: 16,
        zIndex: 99,
        width: 44,
        height: 44,
        borderRadius: 22,
        background: "rgba(255, 255, 255, 0.95)",
        color: "#2d3748",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        display: "none",
        padding: 0,
      }}
      className="mobile-menu-btn"
    />
  );

  return (
    <>
      {/* 桌面端侧边栏 */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        breakpoint="lg"
        collapsedWidth={0}
        trigger={null}
        style={{
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRight: "1px solid rgba(255, 255, 255, 0.5)",
        }}
        className="desktop-sidebar"
      >
        <Menu
          mode="inline"
          selectedKeys={[currentPage]}
          items={menuItems}
          onClick={({ key }) => handleMenuClick(key)}
          style={{
            background: "transparent",
            borderRight: 0,
            padding: "8px 0",
          }}
        />
      </Sider>

      {/* 移动端抽屉菜单 - 从左边缘留出安全距离 */}
      <Drawer
        title=""
        placement="left"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        width={280}
        bodyStyle={{ padding: 0, background: "rgba(255, 255, 255, 0.98)" }}
        headerStyle={{
          display: "none",
          background: "rgba(255, 255, 255, 0.98)",
        }}
        maskStyle={{ background: "rgba(0, 0, 0, 0.5)" }}
      >
        <div style={{ padding: "60px 16px 16px" }}>
          <Typography.Title
            level={4}
            style={{ margin: "0 0 24px", color: "#2d3748" }}
          >
            菜单
          </Typography.Title>
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            items={menuItems}
            onClick={({ key }) => handleMenuClick(key)}
            style={{
              background: "transparent",
              borderRight: 0,
              fontSize: 16,
            }}
            itemIcon={<span style={{ fontSize: 20 }} />}
          />
        </div>
      </Drawer>

      <MobileMenuButton />

      <style>{`
        @media (max-width: 1200px) {
          .desktop-sidebar {
            display: none !important;
          }
          .mobile-menu-btn {
            display: flex !important;
            align-items: center;
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}
