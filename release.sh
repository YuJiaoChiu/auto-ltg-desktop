#!/bin/bash

# Auto-LTG 发布脚本
# 使用方法: ./release.sh [版本号] [发布说明]
# 示例: ./release.sh 1.0.0 "初始版本发布"

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示帮助
show_help() {
    echo "Auto-LTG 发布脚本"
    echo ""
    echo "用法:"
    echo "  ./release.sh <version> [message]"
    echo ""
    echo "参数:"
    echo "  version  - 版本号 (例如: 1.0.0)"
    echo "  message  - 发布说明 (可选)"
    echo ""
    echo "示例:"
    echo "  ./release.sh 1.0.0"
    echo "  ./release.sh 1.0.0 \"修复了视频压缩的bug\""
    echo "  ./release.sh 1.1.0 \"新增AI重命名功能\""
    echo ""
}

# 检查参数
if [ $# -eq 0 ] || [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
    show_help
    exit 0
fi

VERSION=$1
MESSAGE=${2:-"Release version $VERSION"}
TAG="v$VERSION"

echo -e "${BLUE}🎬 Auto-LTG 发布工具${NC}"
echo "=========================="
echo ""

# 验证版本号格式
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}❌ 错误: 版本号格式不正确${NC}"
    echo "版本号必须是语义化版本格式 (例如: 1.0.0)"
    exit 1
fi

# 检查 git 仓库
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ 错误: 当前目录不是 git 仓库${NC}"
    exit 1
fi

# 检查是否有未提交的更改
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  警告: 有未提交的更改${NC}"
    git status --short
    echo ""
    read -p "是否继续? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}已取消${NC}"
        exit 1
    fi
    echo ""
fi

# 检查远程仓库
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE_URL" ]; then
    echo -e "${RED}❌ 错误: 未配置远程仓库${NC}"
    echo "请先运行: git remote add origin <repository-url>"
    exit 1
fi

echo -e "${BLUE}📋 发布信息:${NC}"
echo "  版本号: $VERSION"
echo "  标签: $TAG"
echo "  说明: $MESSAGE"
echo "  远程仓库: $REMOTE_URL"
echo ""

# 确认
read -p "确认发布? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}已取消${NC}"
    exit 1
fi
echo ""

# 检查标签是否已存在
if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  警告: 标签 $TAG 已存在${NC}"
    read -p "是否删除并重新创建? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🗑️  删除本地标签...${NC}"
        git tag -d "$TAG"
        echo -e "${BLUE}🗑️  删除远程标签...${NC}"
        git push origin --delete "$TAG" 2>/dev/null || true
    else
        echo -e "${RED}已取消${NC}"
        exit 1
    fi
    echo ""
fi

# 创建标签
echo -e "${BLUE}🏷️  创建标签 $TAG...${NC}"
git tag -a "$TAG" -m "$MESSAGE"

# 推送代码和标签
echo -e "${BLUE}📤 推送代码到远程仓库...${NC}"
git push origin main

echo -e "${BLUE}📤 推送标签到远程仓库...${NC}"
git push origin "$TAG"

echo ""
echo -e "${GREEN}✅ 发布成功!${NC}"
echo ""
echo -e "${BLUE}📦 下一步:${NC}"
echo "1. 访问 GitHub Actions 查看构建进度:"
echo "   $REMOTE_URL/actions"
echo ""
echo "2. 构建完成后，访问 Releases 页面下载安装包:"
echo "   $REMOTE_URL/releases"
echo ""
echo "3. 编辑 Release 说明，添加详细的更新内容"
echo ""
echo -e "${YELLOW}⏱️  构建大约需要 10-20 分钟，请耐心等待${NC}"
echo ""
