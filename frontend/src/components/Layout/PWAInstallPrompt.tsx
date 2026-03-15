import { useState, useEffect } from "react";
import { message } from "antd";

export const PWAInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<
    | (Event & {
        prompt?: () => Promise<void>;
        userChoice?: Promise<{ outcome: string }>;
      })
    | null
  >(null);

  useEffect(() => {
    // 检查是否已经是PWA模式（standalone）
    const isStandalone = window.matchMedia(
      "(display-mode: standalone)"
    ).matches;

    // 如果已经是PWA模式，不显示提示
    if (isStandalone) {
      return;
    }

    // 检查是否是移动端设备
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    // 检查浏览器是否支持PWA安装
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // 移动端或支持PWA安装的浏览器
      if (isMobile || "ontouchstart" in window) {
        setDeferredPrompt(e as typeof deferredPrompt);
        // 延迟显示提示，让用户先熟悉界面
        setTimeout(() => {
          const dismissed = localStorage.getItem("pwa-install-dismissed");
          if (!dismissed) {
            setShowPrompt(true);
          }
        }, 5000);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // 对于不支持beforeinstallprompt的浏览器，显示手动指引
      message.info(
        <span>
          请点击浏览器菜单{" "}
          <span style={{ fontWeight: "bold" }}>「添加到主屏幕」</span>{" "}
          以获得最佳体验
        </span>,
        5
      );
      return;
    }

    const promptEvent = deferredPrompt as NonNullable<typeof deferredPrompt>;
    promptEvent.prompt!();
    const userChoiceResult = await promptEvent.userChoice;
    if (!userChoiceResult) {
      return;
    }
    const { outcome } = userChoiceResult;

    if (outcome === "accepted") {
      message.success("已添加到主屏幕！");
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // 记录用户已拒绝，7天内不再显示
    localStorage.setItem("pwa-install-dismissed", "true");
    setTimeout(() => {
      localStorage.removeItem("pwa-install-dismissed");
    }, 7 * 24 * 60 * 60 * 1000);
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "100px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "linear-gradient(135deg, #fb7299 0%, #fc9bb8 100%)",
        color: "white",
        padding: "12px 20px",
        borderRadius: "12px",
        boxShadow: "0 4px 20px rgba(251, 114, 153, 0.4)",
        zIndex: 9999,
        maxWidth: "90%",
        textAlign: "center",
        animation: "slideUp 0.3s ease-out",
      }}
    >
      <div style={{ marginBottom: "8px", fontSize: "14px" }}>
        <span style={{ fontSize: "18px" }}>📱</span> 添加到主屏幕，播放更流畅！
      </div>
      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
        <button
          onClick={handleInstall}
          style={{
            background: "white",
            color: "#fb7299",
            border: "none",
            padding: "6px 16px",
            borderRadius: "20px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "13px",
          }}
        >
          立即添加
        </button>
        <button
          onClick={handleDismiss}
          style={{
            background: "transparent",
            color: "white",
            border: "1px solid white",
            padding: "6px 12px",
            borderRadius: "20px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          暂不需要
        </button>
      </div>
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
