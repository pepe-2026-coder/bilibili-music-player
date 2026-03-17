# ========== 构建阶段 ==========
FROM node:20-alpine AS builder

WORKDIR /build

# 复制后端代码
COPY backend/package*.json ./backend/
WORKDIR /build/backend

# 设置镜像源并安装依赖
RUN npm config set registry https://registry.npmmirror.com && \
    npm ci --only=production

# ========== 运行阶段 ==========
FROM node:20-alpine

# 设置 npm 镜像源
RUN npm config set registry https://registry.npmmirror.com

# 创建非root用户
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -D appuser

WORKDIR /app

# 创建数据目录
RUN mkdir -p /app/data /app/downloads /app/cache /app/temp && \
    chown -R appuser:appgroup /app

# 从构建阶段复制编译后的文件
COPY --from=builder /build/backend/node_modules ./node_modules
COPY --from=builder /build/backend/dist ./dist
COPY --from=builder /build/backend/package*.json ./

# 复制前端构建产物
COPY frontend/dist ./public

# 切换到非root用户
USER appuser

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

CMD ["node", "dist/app.js"]
