#!/bin/sh
set -e

# ============= 配置 =============
# 从环境变量读取，docker-compose.yml 中配置
REPO_OWNER="${REPO_OWNER:-你的GitHub用户名}"
REPO_NAME="${REPO_NAME:-bilibili-music-player}"
# ================================

APP_DIR="/app"
DATA_DIR="/app/data"
DOWNLOADS_DIR="/app/downloads"
CACHE_DIR="/app/cache"
TEMP_DIR="/app/temp"

echo "=== B站音乐播放器启动 ==="

# 创建必要目录
mkdir -p "$DATA_DIR" "$DOWNLOADS_DIR" "$CACHE_DIR" "$TEMP_DIR"

# 获取最新 release
echo "检查更新..."
LATEST_INFO=$(curl -sL "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest")

LATEST_URL=$(echo "$LATEST_INFO" | grep '"browser_download_url"' | grep 'bilibili-music-player.tar.gz' | cut -d '"' -f 4)
NEW_VERSION=$(echo "$LATEST_INFO" | grep '"tag_name"' | cut -d '"' -f4)

if [ -z "$LATEST_URL" ]; then
    echo "错误: 无法获取最新版本"
    exit 1
fi

# 检查是否需要更新
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
    # 备份数据目录
    cp -r "$DATA_DIR" /tmp/data_backup 2>/dev/null || true

    # 清理旧文件
    rm -rf "$APP_DIR"/*
    mkdir -p "$APP_DIR"

    # 解压
    tar -xzf /tmp/bilibili-music-player.tar.gz -C "$APP_DIR"

    # 恢复数据目录
    rm -rf "$DATA_DIR" "$DOWNLOADS_DIR" "$CACHE_DIR" "$TEMP_DIR"
    mkdir -p "$DATA_DIR" "$DOWNLOADS_DIR" "$CACHE_DIR" "$TEMP_DIR"
    cp -r /tmp/data_backup/* "$DATA_DIR/" 2>/dev/null || true

    # 记录版本
    echo "$NEW_VERSION" > "$CURRENT_VERSION_FILE"

    rm -f /tmp/bilibili-music-player.tar.gz
    rm -rf /tmp/data_backup
    echo "更新完成!"
fi

# 安装生产依赖
cd "$APP_DIR"
echo "安装依赖..."
npm ci --omit=dev --legacy-peer-deps 2>/dev/null || npm install --omit=dev --legacy-peer-deps

# 启动服务
echo "启动服务..."
exec node dist/app.js
