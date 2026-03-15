import { useState } from "react";
import {
  Layout,
  Button,
  Avatar,
  Space,
  Typography,
  Modal,
  message,
} from "antd";
import {
  LoginOutlined,
  LogoutOutlined,
  CustomerServiceOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "../../stores/authStore";
import { proxyApi } from "../../services/api";
import LoginModal from "../Auth/LoginModal";

const { Header } = Layout;
const { Title } = Typography;

export default function AppHeader() {
  const { isLoggedIn, user, logout } = useAuthStore();
  const [loginModalVisible, setLoginModalVisible] = useState(false);

  const handleLogout = () => {
    Modal.confirm({
      title: "确认退出",
      content: "确定要退出登录吗？",
      onOk: async () => {
        try {
          await logout();
          message.success("已退出登录");
        } catch (error) {
          console.error("退出登录失败:", error);
          message.error("退出登录失败，请重试");
        }
      },
    });
  };

  return (
    <Header
      style={{
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255, 255, 255, 0.6)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 2px 20px rgba(0, 0, 0, 0.08)",
      }}
    >
      <Space>
        <div style={{ display: "flex", alignItems: "center" }}>
          <CustomerServiceOutlined style={{ fontSize: 28, color: "#fb7299" }} />
        </div>
        <Title
          level={4}
          style={{ margin: 0, color: "#2d3748", fontWeight: 600 }}
        >
          Bilibili Music
        </Title>
      </Space>

      <Space>
        {isLoggedIn && user ? (
          <>
            <Space style={{ color: "#4a5568" }}>
              <Avatar
                src={proxyApi.getImageUrl(user.avatar)}
                icon={<UserOutlined />}
                size="small"
                style={{
                  border: "2px solid #fb7299",
                  backgroundColor: "#fb7299",
                }}
                onError={() => {
                  console.error("Avatar load failed:", user.avatar);
                  return true;
                }}
              />
              <span style={{ display: "none" }} className="show-on-desktop">
                {user.username}
              </span>
            </Space>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              style={{ color: "#4a5568" }}
            >
              <span className="hide-on-mobile">退出</span>
            </Button>
          </>
        ) : (
          <Button
            type="primary"
            icon={<LoginOutlined />}
            onClick={() => setLoginModalVisible(true)}
            style={{
              background: "#fb7299",
              borderColor: "#fb7299",
              borderRadius: 20,
              padding: "0 20px",
            }}
          >
            登录
          </Button>
        )}
      </Space>

      <LoginModal
        visible={loginModalVisible}
        onClose={() => setLoginModalVisible(false)}
      />
    </Header>
  );
}
