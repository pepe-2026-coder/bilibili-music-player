# B站音乐播放器 🎵

> 一款基于 B 站 API 开发的在线音乐播放器，在线播放、下载、管理歌单，一个都不能少！

## ✨ 功能特性

| 功能 | 描述 |
|------|------|
| 🔍 音乐搜索 | 搜索 B 站上的海量音乐资源 |
| ▶️ 在线播放 | 流式播放，支持播放列表管理 |
| ⬇️ 音乐下载 | 将喜欢的歌曲下载到本地 |
| 📋 歌单管理 | 创建、编辑、删除个人歌单 |
| 📱 PWA 支持 | 可安装为本地应用，离线也能用 |
| 🐳 Docker 部署 | 一键部署到服务器 |

## 🛠️ 技术栈

### 前端
![React](https://img.shields.io/badge/React-19-blue?style=flat-square) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square) ![Vite](https://img.shields.io/badge/Vite-8-purple?style=flat-square)

- React 19 + TypeScript
- Vite (构建工具)
- Ant Design (UI 组件库)
- Zustand (状态管理)
- Howler.js (音频播放)
- PWA (渐进式应用)

### 后端
- Express + TypeScript
- better-sqlite3 (数据库)
- @renmu/bili-api (B站 API)

## 🚀 快速开始

### 本地开发

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd bilibili-music-player

# 2. 启动后端服务
cd backend
npm install
npm run dev

# 3. 启动前端服务 (新开一个终端)
cd ../frontend
npm install
npm run dev
```

访问 http://localhost:5173 即可开始使用！

### Docker 部署

```bash
cd bilibili-music-player
docker-compose up -d
```

访问 http://localhost:8832

> 💡 本项目主要用于 NAS 部署或在线部署。如需 APP 版本，请联系作者。

## 📱 项目预览

### 搜索页面
![搜索页面](/images/搜索.png)

### 播放界面
![播放界面](/images/播放界面.png)

### 歌单页面
![歌单页面](/images/歌单.png)

### 下载页面
![下载页面](/images/下载.png)

## 📂 目录结构

```
bilibili-music-player/
├── backend/           # 后端服务
│   ├── src/
│   │   ├── models/   # 数据模型
│   │   ├── routes/   # API 路由
│   │   ├── services/ # 业务逻辑
│   │   └── app.ts    # 应用入口
│   ├── downloads/    # 下载目录
│   ├── cache/       # 缓存目录
│   └── data/        # 数据目录
├── frontend/         # 前端应用
│   ├── src/
│   │   ├── components/  # 组件
│   │   ├── pages/      # 页面
│   │   ├── services/   # API 服务
│   │   ├── stores/     # 状态管理
│   │   └── styles/     # 样式
│   └── public/      # 静态资源
├── images/          # 项目截图
└── docker-compose.yml
```

## ☕ 支持项目

如果你觉得这个项目对你有帮助，欢迎扫码请我喝杯咖啡！

![请我喝咖啡](/images/微信请我喝咖啡.jpg)

感谢你的支持！ 🎉

## 许可证

ISC
