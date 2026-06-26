# 楼盘销售分析系统 Docker 构建文件
# 基于 Node.js 22 LTS（内置 SQLite 支持）

# ==================== 前端构建阶段 ====================
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制前端依赖文件
COPY frontend/package.json frontend/package-lock.json* ./

# 安装依赖
RUN npm ci --prefer-offline --no-audit

# 复制前端源代码
COPY frontend/ ./

# 构建前端生产版本
RUN npm run build

# ==================== 最终运行阶段 ====================
FROM node:22-alpine

LABEL maintainer="楼盘销售分析系统"
LABEL description="楼盘销售分析与网签管理系统"
LABEL version="1.0.0"

WORKDIR /app

# 安装 tini 作为进程管理器
RUN apk add --no-cache tini

# 复制后端依赖文件
COPY backend/package.json backend/package-lock.json* ./backend/

# 安装后端生产依赖
WORKDIR /app/backend
RUN npm ci --only=production --prefer-offline --no-audit

# 复制后端源代码
COPY backend/src ./src

# 从前端构建阶段复制构建产物到 backend/frontend/dist
WORKDIR /app/backend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 创建数据目录（用于 SQLite 数据库持久化）
RUN mkdir -p /app/data

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATA_DIR=/app/data

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 使用 tini 启动，确保信号正确传递
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]