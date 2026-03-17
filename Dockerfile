FROM node:20-alpine

# 设置 npm 镜像源
RUN npm config set registry https://registry.npmmirror.com

# 安装 curl 用于下载代码
RUN apk add --no-cache curl

WORKDIR /app

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 复制启动脚本
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 创建数据目录
RUN mkdir -p /app/data /app/downloads /app/cache /app/temp

# 暴露端口
EXPOSE 3000

# 启动脚本
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
