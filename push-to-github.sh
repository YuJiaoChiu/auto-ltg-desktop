#!/bin/bash

# Auto-LTG GitHub 推送助手
# 一键完成 GitHub 仓库创建和代码推送

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Auto-LTG GitHub 推送助手${NC}"
echo "=============================="
echo ""

# 检查 git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ 未找到 git 命令${NC}"
    exit 1
fi

# 获取 GitHub 用户名
echo -e "${BLUE}📝 请输入你的 GitHub 用户名:${NC}"
read -r GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo -e "${RED}❌ 用户名不能为空${NC}"
    exit 1
fi

# 获取仓库名称
echo -e "${BLUE}📝 请输入仓库名称 (默认: auto-ltg-desktop):${NC}"
read -r REPO_NAME
REPO_NAME=${REPO_NAME:-auto-ltg-desktop}

# 确认信息
echo ""
echo -e "${BLUE}📋 确认信息:${NC}"
echo "  GitHub 用户名: $GITHUB_USERNAME"
echo "  仓库名称: $REPO_NAME"
echo "  仓库地址: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
echo ""
read -p "确认无误? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}已取消${NC}"
    exit 1
fi
echo ""

# 检查远程仓库
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [ -n "$CURRENT_REMOTE" ]; then
    echo -e "${YELLOW}⚠️  已配置远程仓库: $CURRENT_REMOTE${NC}"
    read -p "是否覆盖? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}已取消${NC}"
        exit 1
    fi
    git remote remove origin
fi

# 添加远程仓库
echo -e "${BLUE}🔗 添加远程仓库...${NC}"
git remote add origin "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"

# 设置分支名称
git branch -M main

echo ""
echo -e "${BLUE}📤 推送到 GitHub...${NC}"
echo ""

# 推送代码
if git push -u origin main; then
    echo ""
    echo -e "${GREEN}✅ 推送成功!${NC}"
    echo ""
    echo -e "${BLUE}🔗 仓库地址:${NC}"
    echo "  https://github.com/$GITHUB_USERNAME/$REPO_NAME"
    echo ""
    echo -e "${BLUE}📦 下一步:${NC}"
    echo "1. 访问仓库页面确认代码已上传"
    echo "2. 等待 GitHub Actions 自动构建 (约 10-20 分钟)"
    echo "3. 访问 Releases 页面下载安装包"
    echo ""
else
    echo ""
    echo -e "${RED}❌ 推送失败${NC}"
    echo ""
    echo "可能的原因:"
    echo "1. 仓库不存在 - 请先在 GitHub 创建仓库"
    echo "2. 权限问题 - 检查 GitHub 凭据"
    echo "3. 网络问题 - 检查网络连接"
    echo ""
    echo -e "${YELLOW}💡 建议手动操作:${NC}"
    echo "1. 访问 https://github.com/new 创建仓库"
    echo "2. 仓库名称: $REPO_NAME"
    echo "3. 选择 Public"
    echo "4. 不要勾选 'Initialize this repository with'"
    echo "5. 重新运行本脚本"
    echo ""
    exit 1
fi
