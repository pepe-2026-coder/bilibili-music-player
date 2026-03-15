import {
  SearchOutlined,
  UnorderedListOutlined,
  DownloadOutlined,
} from "@ant-design/icons";

interface MobileBottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function MobileBottomNav({
  currentPage,
  onNavigate,
}: MobileBottomNavProps) {
  const menuItems = [
    {
      key: "search",
      icon: <SearchOutlined />,
      label: "搜索",
    },
    {
      key: "playlists",
      icon: <UnorderedListOutlined />,
      label: "歌单",
    },
    {
      key: "downloads",
      icon: <DownloadOutlined />,
      label: "下载",
    },
  ];

  return (
    <div className="mobile-bottom-nav">
      {menuItems.map((item) => (
        <div
          key={item.key}
          className={`nav-item ${currentPage === item.key ? "active" : ""}`}
          onClick={() => onNavigate(item.key)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </div>
      ))}

      <style>{`
        .mobile-bottom-nav {
          width: 100%;
          height: 60px;
          display: flex !important;
          justify-content: space-around !important;
          align-items: center !important;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
          padding-bottom: env(safe-area-inset-bottom, 0);
          box-sizing: border-box;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        .mobile-bottom-nav .nav-item {
          flex: 1 !important;
          display: flex !important;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 6px 0;
          height: 100%;
          visibility: visible !important;
        }
        
        .mobile-bottom-nav .nav-icon {
          font-size: 22px;
          color: #595959;
          margin-bottom: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .mobile-bottom-nav .nav-label {
          font-size: 11px;
          line-height: 1.2;
          color: #595959;
        }
        
        .mobile-bottom-nav .nav-item.active .nav-icon,
        .mobile-bottom-nav .nav-item.active .nav-label {
          color: #fb7299;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
