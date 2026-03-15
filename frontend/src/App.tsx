import { useEffect, useState } from "react";
import { ConfigProvider, theme, Layout, Spin } from "antd";
import { useAuthStore } from "./stores/authStore";
import { usePlayerStore } from "./stores/playerStore";
import AppHeader from "./components/Layout/AppHeader";
import AppSidebar from "./components/Layout/AppSidebar";
import MobileBottomNav from "./components/Layout/MobileBottomNav";
import PlayerBar from "./components/Player/PlayerBar";
import MainContent from "./components/Layout/MainContent";
import { PWAInstallPrompt } from "./components/Layout/PWAInstallPrompt";

const { Content } = Layout;

function App() {
  const { checkLoginStatus, isLoading } = useAuthStore();
  const { initAudio, restoreState } = usePlayerStore();
  const [currentPage, setCurrentPage] = useState("search");

  const handleMenuSelect = (key: string) => {
    console.log("Menu selected:", key);
    console.log("Current page before change:", currentPage);
    setCurrentPage(key);
    console.log("Current page after change:", key);
  };

  useEffect(() => {
    checkLoginStatus();
    initAudio();
    // 页面加载后恢复播放状态，但保持暂停和进度为0
    setTimeout(() => {
      restoreState();
    }, 100);
  }, []);

  if (isLoading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background:
            "linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 50%, #d1d8e0 100%)",
        }}
      >
        <div
          style={{
            padding: 40,
            background: "rgba(255, 255, 255, 0.8)",
            backdropFilter: "blur(12px)",
            borderRadius: 20,
            boxShadow: "0 8px 32px rgba(31, 38, 135, 0.15)",
          }}
        >
          <Spin size="large" tip="加载中..." />
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#fb7299",
          colorInfo: "#fb7299",
          borderRadius: 12,
          colorBgBase: "#f5f7fa",
          colorBgContainer: "rgba(255, 255, 255, 0.8)",
          colorBgElevated: "rgba(255, 255, 255, 0.95)",
          colorText: "#2d3748",
          colorTextSecondary: "#4a5568",
          colorBorder: "rgba(255, 255, 255, 0.6)",
        },
      }}
    >
      <style>{`
        @media (max-width: 1200px) {
          .main-content {
            margin-bottom: 200px !important; /* 移动端：播放器 (~90px) + 底部导航 (~60px) + 安全区域 */
          }
        }
        @media (min-width: 1201px) {
          .main-content {
            margin-bottom: 100px !important; /* 桌面端只给播放器留出空间 */
          }
        }
      `}</style>
      <Layout
        style={{
          minHeight: "100vh",
          background: "transparent",
        }}
      >
        <AppHeader />
        <Layout style={{ background: "transparent" }}>
          <AppSidebar
            onMenuSelect={handleMenuSelect}
            currentPage={currentPage}
          />
          <Content
            className="main-content"
            style={{
              margin: "16px",
              marginBottom: "120px" /* 增加底部边距以适应播放条和导航栏 */,
              padding: 20,
              minHeight: 280,
              background: "rgba(255, 255, 255, 0.6)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderRadius: 16,
              overflow: "auto",
              border: "1px solid rgba(255, 255, 255, 0.5)",
              boxShadow: "0 8px 32px rgba(31, 38, 135, 0.1)",
            }}
          >
            <MainContent
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
            />
          </Content>
        </Layout>
      </Layout>
      {/* 底部固定容器 - 播放条始终显示，移动端额外显示导航栏 */}
      <div className="bottom-fixed-container">
        <PlayerBar />
        <MobileBottomNav
          currentPage={currentPage}
          onNavigate={setCurrentPage}
        />
      </div>
      <style>{`
        .bottom-fixed-container {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          display: flex;
          flex-direction: column;
        }
        .bottom-fixed-container .mobile-bottom-nav {
          display: none;
        }
        @media (max-width: 1200px) {
          .bottom-fixed-container .mobile-bottom-nav {
            display: block;
          }
        }
      `}</style>
      <PWAInstallPrompt />
    </ConfigProvider>
  );
}

export default App;
