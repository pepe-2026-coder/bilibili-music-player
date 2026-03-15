import { useState, useEffect, useRef } from "react";
import { Modal, QRCode, Spin, message, Space, Typography, Tabs, Button, Alert } from "antd";
import { authApi } from "../../services/api";
import { useAuthStore } from "../../stores/authStore";

const { Text } = Typography;

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LoginModal({ visible, onClose }: LoginModalProps) {
  const [loginMethod, setLoginMethod] = useState<"qrcode" | "app">("qrcode");
  const [qrcodeUrl, setQrcodeUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [appAuthUrl, setAppAuthUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<
    "pending" | "scanned" | "confirmed" | "expired"
  >("pending");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { checkLoginStatus } = useAuthStore();

  // 获取二维码
  const fetchQrcode = async () => {
    setLoading(true);
    try {
      const apiCall = loginMethod === "qrcode" ? authApi.getQrcode : authApi.getAppQrcode;
      const response = await apiCall();
      console.log("QRCode API response:", response);
      const { data } = response;
      if (data.code === 0) {
        // APP授权模式返回authUrl，扫码模式返回url
        const responseData = data.data as any;
        const url = loginMethod === "app" ? responseData.authUrl : responseData.url;
        setQrcodeUrl(url);
        setSessionId(responseData.sessionId);
        // APP授权模式保存授权URL
        if (loginMethod === "app" && responseData.appAuthUrl) {
          setAppAuthUrl(responseData.appAuthUrl);
        }
        setStatus("pending");
        startPolling(responseData.sessionId, loginMethod);
      } else {
        message.error(data.message || "获取二维码失败");
      }
    } catch (error: any) {
      console.error("获取二维码失败:", error);
      message.error(
        error?.response?.data?.message || error?.message || "获取二维码失败"
      );
    } finally {
      setLoading(false);
    }
  };

  // 轮询登录状态
  const startPolling = (sid: string, method: "qrcode" | "app") => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const apiCall = method === "qrcode" ? authApi.pollLoginStatus : authApi.pollAppLoginStatus;
        const { data } = await apiCall(sid);
        if (data.code === 0) {
          const newStatus = data.data.status as typeof status;
          setStatus(newStatus);

          if (newStatus === "confirmed") {
            // 登录成功
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
            message.success("登录成功！");
            await checkLoginStatus();
            onClose();
          } else if (newStatus === "expired") {
            // 二维码过期
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
          }
        }
      } catch (error) {
        console.error("轮询登录状态失败:", error);
      }
    }, 2000);
  };

  // 切换登录方式时重新获取二维码
  const handleMethodChange = (method: "qrcode" | "app") => {
    setLoginMethod(method);
    setQrcodeUrl("");
    setSessionId("");
    setAppAuthUrl("");
    setStatus("pending");
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
  };

  // 打开APP授权
  const openAppAuth = () => {
    if (appAuthUrl) {
      // 使用 bilibili:// 协议调起APP
      window.location.href = appAuthUrl;
      
      // 同时打开H5页面作为备选
      setTimeout(() => {
        if (qrcodeUrl) {
          window.open(qrcodeUrl, "_blank");
        }
      }, 1500);
    }
  };

  // 刷新二维码
  const refreshQrcode = () => {
    setQrcodeUrl("");
    setSessionId("");
    setStatus("pending");
    fetchQrcode();
  };

  useEffect(() => {
    if (visible) {
      fetchQrcode();
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [visible, loginMethod]);

  const getStatusText = () => {
    switch (status) {
      case "pending":
        return loginMethod === "qrcode"
          ? "请使用哔哩哔哩App扫码登录"
          : "请在哔哩哔哩APP中确认授权";
      case "scanned":
        return "已扫描，请在手机上确认登录";
      case "confirmed":
        return "登录成功！";
      case "expired":
        return "二维码已过期，请点击刷新";
      default:
        return "";
    }
  };

  // 渲染APP授权内容
  const renderAppAuth = () => {
    if (loading) {
      return <Spin size="large" />;
    }

    if (!appAuthUrl) {
      return <Text type="secondary">加载中...</Text>;
    }

    return (
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <Alert
          message="APP授权登录"
          description="点击下方按钮调起哔哩哔哩APP，在APP中确认授权登录"
          type="info"
          showIcon
          style={{ marginBottom: 24, textAlign: "left" }}
        />
        <Button
          type="primary"
          size="large"
          onClick={openAppAuth}
          style={{ minWidth: 200, height: 48, fontSize: 16 }}
        >
          打开哔哩哔哩APP授权
        </Button>
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            如果未安装APP，将自动打开网页版授权
          </Text>
        </div>
        {status === "expired" && (
          <div style={{ marginTop: 16 }}>
            <Button type="link" onClick={refreshQrcode}>
              授权已过期，点击重新获取
            </Button>
          </div>
        )}
        <div style={{ marginTop: 24 }}>
          <Text type={status === "expired" ? "danger" : "secondary"}>
            {getStatusText()}
          </Text>
        </div>
      </div>
    );
  };

  // 渲染扫码登录内容
  const renderQrcodeLogin = () => {
    if (loading) {
      return <Spin size="large" />;
    }

    return (
      <>
        {qrcodeUrl && status !== "expired" ? (
          <QRCode
            value={qrcodeUrl}
            size={200}
            status={status === "scanned" ? "scanned" : "active"}
          />
        ) : (
          <div
            style={{
              width: 200,
              height: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f5f5f5",
            }}
          >
            <Text type="secondary">二维码已过期</Text>
          </div>
        )}
        <Text type={status === "expired" ? "danger" : "secondary"} style={{ marginTop: 16 }}>
          {getStatusText()}
        </Text>
        {status === "expired" && (
          <a onClick={refreshQrcode} style={{ marginTop: 8, display: "block" }}>
            点击刷新二维码
          </a>
        )}
      </>
    );
  };

  return (
    <Modal
      title="登录"
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      width={loginMethod === "app" ? 450 : 400}
    >
      <Tabs
        activeKey={loginMethod}
        onChange={(key) => handleMethodChange(key as "qrcode" | "app")}
        items={[
          {
            key: "qrcode",
            label: "扫码登录",
          },
          {
            key: "app",
            label: "APP授权",
          },
        ]}
        style={{ marginBottom: 16 }}
      />
      <Space
        direction="vertical"
        align="center"
        style={{ width: "100%", padding: "10px 0" }}
      >
        {loginMethod === "app" ? renderAppAuth() : renderQrcodeLogin()}
      </Space>
    </Modal>
  );
}
