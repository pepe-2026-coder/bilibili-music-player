FROM node:20-alpine

# 设置 npm 镜像源
RUN npm config set registry https://registry.npmmirror.com

# 安装 curl 用于下载代码
RUN apk add --no-cache curl

WORKDIR /app

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 接收构建参数
ARG REPO_OWNER=你的GitHub用户名
ARG REPO_NAME=bilibili-music-player

# 暴露端口
EXPOSE 3000

# 复制启动脚本
RUN echo '#!/bin/sh\n\
set -e\n\
\n\
APP_DIR="/app"\n\
DATA_DIR="/app/data"\n\
DOWNLOADS_DIR="/app/downloads"\n\
CACHE_DIR="/app/cache"\n\
TEMP_DIR="/app/temp"\n\
\n\
echo "=== B站音乐播放器启动 ==="\n\
\n\
mkdir -p "$DATA_DIR" "$DOWNLOADS_DIR" "$CACHE_DIR" "$TEMP_DIR"\n\
\n\
echo "检查更新..."\n\
LATEST_INFO=$(curl -sL "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest")\n\
\n\
LATEST_URL=$(echo "$LATEST_INFO" | grep "\"browser_download_url\"" | grep "bilibili-music-player.tar.gz" | cut -d "\"" -f 4)\n\
NEW_VERSION=$(echo "$LATEST_INFO" | grep "\"tag_name\"" | cut -d "\"" -f4)\n\
\n\
if [ -z "$LATEST_URL" ]; then\n\
    echo "错误: 无法获取最新版本"\n\
    exit 1\n\
fi\n\
\n\
CURRENT_VERSION_FILE="$APP_DIR/.version"\n\
CURRENT_VERSION=$(cat "$CURRENT_VERSION_FILE" 2>/dev/null || echo "")\n\
\n\
echo "当前版本: ${CURRENT_VERSION:-首次安装}"\n\
echo "最新版本: $NEW_VERSION"\n\
\n\
if [ "$CURRENT_VERSION" = "$NEW_VERSION" ] && [ -f "$APP_DIR/dist/app.js" ]; then\n\
    echo "已是最新版本，启动服务..."\n\
else\n\
    echo "下载最新版本..."\n\
    curl -L "$LATEST_URL" -o /tmp/bilibili-music-player.tar.gz\n\
\n\
    echo "解压更新..."\n\
    cp -r "$DATA_DIR" /tmp/data_backup 2>/dev/null || true\n\
\n\
    rm -rf "$APP_DIR"/*\n\
    mkdir -p "$APP_DIR"\n\
\n\
    tar -xzf /tmp/bilibili-music-player.tar.gz -C "$APP_DIR"\n\
\n\
    rm -rf "$DATA_DIR" "$DOWNLOADS_DIR" "$CACHE_DIR" "$TEMP_DIR"\n\
    mkdir -p "$DATA_DIR" "$DOWNLOADS_DIR" "$CACHE_DIR" "$TEMP_DIR"\n\
    cp -r /tmp/data_backup/* "$DATA_DIR/" 2>/dev/null || true\n\
\n\
    echo "$NEW_VERSION" > "$CURRENT_VERSION_FILE"\n\
\n\
    rm -f /tmp/bilibili-music-player.tar.gz\n\
    rm -rf /tmp/data_backup\n\
    echo "更新完成!"\n\
fi\n\
\n\
cd "$APP_DIR"\n\
echo "安装依赖..."\n\
npm ci --omit=dev --legacy-peer-deps 2>/dev/null || npm install --omit=dev --legacy-peer-deps\n\
\n\
echo "启动服务..."\n\
exec node dist/app.js' > /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 创建数据目录
RUN mkdir -p /app/data /app/downloads /app/cache /app/temp

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
