# 构建前端
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# 构建后端
FROM node:20-alpine AS backend-builder

# 安装编译原生模块所需的依赖
RUN apk add --no-cache python3 make g++

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY backend/ ./
RUN npm run build

# 生产环境
FROM node:20-alpine

# 安装 FFmpeg 和编译工具（用于 better-sqlite3）
RUN apk add --no-cache ffmpeg python3 make g++

WORKDIR /app

# 复制后端构建产物
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/package*.json ./

# 重新安装后端依赖（在目标平台编译 native 模块）
RUN npm ci --legacy-peer-deps --omit=dev

# 复制前端构建产物
COPY --from=frontend-builder /app/frontend/dist ./public

# 创建数据目录
RUN mkdir -p /app/data /app/downloads /app/cache /app/temp

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "dist/app.js"]
