#!/bin/bash
# 楼盘销售分析系统打包脚本
# 打包前后端源码和 Docker 构建相关文件，输出到 dist 目录

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist"
PACKAGE_NAME="housing-sales-statistics"
VERSION=$(date +%Y%m%d%H%M%S)
OUTPUT_FILE="${DIST_DIR}/${PACKAGE_NAME}-${VERSION}.tar.gz"

echo "=========================================="
echo "楼盘销售分析系统打包脚本"
echo "=========================================="

# 确保 dist 目录存在
mkdir -p "${DIST_DIR}"

# 清理旧的源码包（保留 Docker 镜像 tar 文件）
find "${DIST_DIR}" -name "${PACKAGE_NAME}-*.tar.gz" -type f -delete 2>/dev/null || true

echo "打包内容:"
echo "  - 后端源码 (backend/src/)"
echo "  - 后端依赖 (backend/package.json)"
echo "  - 前端源码 (frontend/src/)"
echo "  - 前端依赖 (frontend/package.json)"
echo "  - 前端配置 (frontend/vite.config.js)"
echo "  - Docker 构建文件 (Dockerfile, docker-compose.yml, .dockerignore)"
echo "  - 构建脚本 (build.sh)"
echo ""

# 创建临时目录
TEMP_DIR=$(mktemp -d)
PACKAGE_DIR="${TEMP_DIR}/${PACKAGE_NAME}"

mkdir -p "${PACKAGE_DIR}"

# 复制后端文件
echo "复制后端文件..."
mkdir -p "${PACKAGE_DIR}/backend/src"
cp -r "${SCRIPT_DIR}/backend/src"/* "${PACKAGE_DIR}/backend/src/"
cp "${SCRIPT_DIR}/backend/package.json" "${PACKAGE_DIR}/backend/"

# 复制前端文件
echo "复制前端文件..."
mkdir -p "${PACKAGE_DIR}/frontend/src"
cp -r "${SCRIPT_DIR}/frontend/src"/* "${PACKAGE_DIR}/frontend/src/"
cp "${SCRIPT_DIR}/frontend/package.json" "${PACKAGE_DIR}/frontend/"
cp "${SCRIPT_DIR}/frontend/vite.config.js" "${PACKAGE_DIR}/frontend/"

# 复制 Docker 构建文件
echo "复制 Docker 构建文件..."
cp "${SCRIPT_DIR}/Dockerfile" "${PACKAGE_DIR}/"
cp "${SCRIPT_DIR}/docker-compose.yml" "${PACKAGE_DIR}/"
cp "${SCRIPT_DIR}/.dockerignore" "${PACKAGE_DIR}/"

# 复制构建脚本
echo "复制构建脚本..."
cp "${SCRIPT_DIR}/build.sh" "${PACKAGE_DIR}/"

# 创建部署说明文件
echo "创建部署说明文件..."
cat > "${PACKAGE_DIR}/README-DEPLOY.md" << 'EOF'
# 楼盘销售分析系统部署说明

## 目录结构

```
housing-sales-statistics/
├── backend/
│   ├── src/              # 后端源码
│   └── package.json      # 后端依赖
├── frontend/
│   ├── src/              # 前端源码
│   ├── package.json      # 前端依赖
│   └── vite.config.js    # Vite 配置
├── Dockerfile            # Docker 构建文件
├── docker-compose.yml    # Docker Compose 配置
├── .dockerignore         # Docker 构建忽略文件
├── build.sh              # 构建脚本
└── README-DEPLOY.md      # 部署说明
```

## 部署方法

### 方法一：使用 Docker Compose（推荐）

```bash
# 1. 解压包
tar -xzf housing-sales-statistics-*.tar.gz

# 2. 进入目录
cd housing-sales-statistics

# 3. 构建并启动
docker-compose up -d --build

# 4. 查看状态
docker-compose ps

# 5. 查看日志
docker-compose logs -f
```

### 方法二：使用构建脚本

```bash
# 1. 解压包
tar -xzf housing-sales-statistics-*.tar.gz

# 2. 进入目录
cd housing-sales-statistics

# 3. 执行构建脚本（构建 AMD64 镜像）
chmod +x build.sh
./build.sh

# 4. 加载镜像
docker load -i dist/housing-sales-statistics-latest-amd64.tar

# 5. 运行容器
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data housing-sales-statistics:latest
```

### 方法三：手动构建

```bash
# 1. 解压包
tar -xzf housing-sales-statistics-*.tar.gz

# 2. 进入目录
cd housing-sales-statistics

# 3. 构建镜像
docker build -t housing-sales-statistics:latest .

# 4. 运行容器
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data housing-sales-statistics:latest
```

## 数据持久化

数据库文件存储在 `./data/` 目录，通过 Docker 挂载持久化：

- 数据库路径: `/app/data/housing_sales.db`
- 本地挂载: `./data:/app/data`

## 访问地址

- 前端页面: http://localhost:3000
- API 接口: http://localhost:3000/api

## 常用命令

```bash
# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f

# 备份数据库
cp ./data/housing_sales.db ./data/backup_$(date +%Y%m%d).db

# 清理旧数据（谨慎操作）
docker-compose down -v
rm -rf ./data/housing_sales.db
```

## 系统要求

- Docker 20.10+
- Docker Compose 2.0+
- 端口 3000 未被占用
EOF

# 打包
echo "打包文件..."
cd "${TEMP_DIR}"
tar -czf "${OUTPUT_FILE}" "${PACKAGE_NAME}"

# 清理临时目录
rm -rf "${TEMP_DIR}"

echo ""
echo "=========================================="
echo "打包完成！"
echo "=========================================="
echo "输出文件: ${OUTPUT_FILE}"
echo "文件大小: $(du -h "${OUTPUT_FILE}" | cut -f1)"
echo ""
echo "使用方法:"
echo "  1. 解压: tar -xzf ${OUTPUT_FILE}"
echo "  2. 进入目录: cd ${PACKAGE_NAME}"
echo "  3. 部署: docker-compose up -d --build"
echo ""