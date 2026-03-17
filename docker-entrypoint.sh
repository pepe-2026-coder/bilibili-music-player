#!/bin/sh
set -e

APP_DIR="/app"
DATA_DIR="/app/data"
DOWNLOADS_DIR="/app/downloads"
CACHE_DIR="/app/cache"
TEMP_DIR="/app/temp"

# 获取镜像配置
echo "=== B站音乐播放器启动 ==="
mkdir -p "$DATA_DIR" "$DOWNLOADS_DIR" "$CACHE_DIR" "$TEMP_DIR"

# 根据镜像配置构建 URL
GITHUB_MIRROR="${GITHUB_MIRROR:-}"
if [ "$GITHUB_MIRROR" = "ghproxy" ]; then
    API_URL="https://ghproxy.com/https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest"
    DOWNLOAD_PREFIX="https://ghproxy.com/"
elif [ "$GITHUB_MIRROR" = "mirror" ]; then
    API_URL="https://mirror.ghproxy.com/https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest"
    DOWNLOAD_PREFIX="https://mirror.ghproxy.com/"
else
    API_URL="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest"
    DOWNLOAD_PREFIX=""
fi

echo "检查更新..."
echo "镜像模式: ${GITHUB_MIRROR:-直连}"
LATEST_INFO=$(curl -sL "$API_URL")

LATEST_URL=$(echo "$LATEST_INFO" | grep "\"browser_download_url\"" | grep "bilibili-music-player.tar.gz" | cut -d '"' -f 4)
NEW_VERSION=$(echo "$LATEST_INFO" | grep "\"tag_name\"" | cut -d '"' -f4)

if [ -z "$LATEST_URL" ]; then
    echo "错误: 无法获取最新版本"
    exit 1
fi

# 添加镜像前缀
if [ -n "$DOWNLOAD_PREFIX" ]; then
    LATEST_URL="${DOWNLOAD_PREFIX}${LATEST_URL}"
fi

CURRENT_VERSION_FILE="$APP_DIR/.version"
CURRENT_VERSION=$(cat "$CURRENT_VERSION_FILE" 2>/dev/null || echo "")

echo "当前版本: ${CURRENT_VERSION:-首次安装}"
echo "最新版本: $NEW_VERSION"

if [ "$CURRENT_VERSION" = "$NEW_VERSION" ] && [ -f "$APP_DIR/dist/app.js" ]; then
    echo "已是最新版本，启动服务..."
else
    echo "下载最新版本..."
    curl -L "$LATEST_URL" -o /tmp/bilibili-music-player.tar.gz

    echo "解压更新..."
    cp -r "$DATA_DIR" /tmp/data_backup 2>/dev/null || true

    rm -rf "$APP_DIR"/*
    mkdir -p "$APP_DIR"

    tar -xzf /tmp/bilibili-music-player.tar.gz -C "$APP_DIR"

    rm -rf "$DATA_DIR" "$DOWNLOADS_DIR" "$CACHE_DIR" "$TEMP_DIR"
    mkdir -p "$DATA_DIR" "$DOWNLOADS_DIR" "$CACHE_DIR" "$TEMP_DIR"
    cp -r /tmp/data_backup/* "$DATA_DIR/" 2>/dev/null || true

    echo "$NEW_VERSION" > "$CURRENT_VERSION_FILE"

    rm -f /tmp/bilibili-music-player.tar.gz
    rm -rf /tmp/data_backup
    echo "更新完成!"
fi

cd "$APP_DIR"
echo "安装依赖..."
npm ci --omit=dev --legacy-peer-deps 2>/dev/null || npm install --omit=dev --legacy-peer-deps

echo "启动服务..."
exec node dist/app.js
