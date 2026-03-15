import { useState } from "react";
import SearchPage from "../../pages/SearchPage";
import PlaylistPage from "../../pages/PlaylistPage";
import DownloadsPage from "../../pages/DownloadsPage";

interface MainContentProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

export default function MainContent({
  currentPage,
  setCurrentPage,
}: MainContentProps) {
  const renderPage = () => {
    switch (currentPage) {
      case "search":
        return <SearchPage />;
      case "playlists":
        return <PlaylistPage />;
      case "downloads":
        return <DownloadsPage />;
      default:
        return <SearchPage />; // 默认显示搜索页面
    }
  };

  return <div>{renderPage()}</div>;
}
