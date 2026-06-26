#!/bin/bash
# Docker 镜像构建脚本
# 构建 AMD64 架构镜像并导出到 dist 目录

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist"
IMAGE_NAME="housing-sales-statistics"
IMAGE_TAG="latest"

echo "=========================================="
echo "构建 AMD64 架构 Docker 镜像"
echo "=========================================="

# 确保 dist 目录存在
mkdir -p "${DIST_DIR}"

# 确保 buildx 可用
docker buildx version > /dev/null 2>&1 || {
    echo "错误: docker buildx 不可用"
    echo "请确保 Docker 版本支持 buildx"
    exit 1
}

# 创建 builder 实例（如果不存在）
BUILDER_NAME="multiarch-builder"
if ! docker buildx inspect "${BUILDER_NAME}" > /dev/null 2>&1; then
    echo "创建 buildx builder 实例..."
    docker buildx create --name "${BUILDER_NAME}" --use
fi

# 构建镜像并导出为 tar 文件
echo "开始构建镜像..."
docker buildx build \
    --platform linux/amd64 \
    --output type=docker,dest="${DIST_DIR}/${IMAGE_NAME}-${IMAGE_TAG}-amd64.tar" \
    --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
    --file "${SCRIPT_DIR}/Dockerfile" \
    "${SCRIPT_DIR}"

echo "=========================================="
echo "构建完成！"
echo "=========================================="
echo "镜像文件: ${DIST_DIR}/${IMAGE_NAME}-${IMAGE_TAG}-amd64.tar"
echo ""
echo "使用方法:"
echo "  1. 加载镜像: docker load -i ${DIST_DIR}/${IMAGE_NAME}-${IMAGE_TAG}-amd64.tar"
echo "  2. 运行容器: docker run -d -p 3000:3000 -v housing-data:/app/data ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""