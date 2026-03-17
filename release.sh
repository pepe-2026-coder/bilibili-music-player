#!/bin/bash
set -e

# 确保在项目根目录
cd "$(dirname "$0")"

echo "=== 开始构建 Release ==="

# 1. 安装前端依赖并构建
echo "[1/5] 构建前端..."
cd frontend
npm ci --legacy-peer-deps
npm run build
cd ..

# 2. 安装后端依赖并构建
echo "[2/5] 构建后端..."
cd backend
npm ci --legacy-peer-deps
npm run build
cd ..

# 3. 创建 release 目录并打包
echo "[3/5] 打包 Release..."
rm -rf release
mkdir -p release

# 复制后端
cp -r backend/dist release/
cp backend/package*.json release/
cp -r backend/data release/ 2>/dev/null || true

# 复制前端
cp -r frontend/dist release/public

# 复制 Docker 文件
cp Dockerfile release/
cp docker-compose.yml release/

# 打包
cd release
tar -czf ../bilibili-music-player.tar.gz .

echo "[4/5] 创建 GitHub Release..."
gh release create \
  --latest \
  --title "Release $(date +%Y.%m.%d)" \
  --generate-notes \
  bilibili-music-player.tar.gz

echo "[5/5] 清理临时文件..."
cd ..
rm -rf release

echo "=== Release 完成 ==="
