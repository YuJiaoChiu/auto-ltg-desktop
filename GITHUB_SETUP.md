# GitHub 仓库设置指南

本指南将帮助你手动将 Auto-LTG 项目推送到 GitHub 并启用自动构建。

## 方法一：使用 GitHub 网站创建仓库（推荐）

### 步骤 1：在 GitHub 创建新仓库

1. 访问 [GitHub](https://github.com) 并登录
2. 点击右上角 **+** 按钮 → **New repository**
3. 填写仓库信息：
   - **Repository name**: `auto-ltg-desktop` （或你喜欢的名称）
   - **Description**: `Auto-LTG - 字幕组统一工具平台`
   - **Visibility**: Public（推荐）
   - **Initialize this repository with**: ❌ 不要勾选任何选项
4. 点击 **Create repository**

### 步骤 2：推送本地代码

GitHub 会显示推送命令，复制并执行以下命令（替换 `YOUR_USERNAME` 为你的 GitHub 用户名）：

```bash
# 添加远程仓库地址
git remote add origin https://github.com/YOUR_USERNAME/auto-ltg-desktop.git

# 推送代码到 main 分支
git branch -M main
git push -u origin main
```

### 步骤 3：验证推送

访问 `https://github.com/YOUR_USERNAME/auto-ltg-desktop` 确认代码已上传。

---

## 方法二：使用 GitHub Desktop（图形界面）

1. 下载并安装 [GitHub Desktop](https://desktop.github.com/)
2. 打开 GitHub Desktop
3. 选择 **File** → **Add local repository**
4. 选择 `/Users/yujiao.zhao/Desktop/auto-ltg` 文件夹
5. 点击 **Publish repository**
6. 填写仓库名称和描述，选择 Public
7. 点击 **Publish Repository**

---

## 方法三：使用 SSH 密钥推送

如果你配置了 SSH 密钥，可以使用 SSH 地址：

```bash
# 使用 SSH 地址添加远程仓库
git remote add origin git@github.com:YOUR_USERNAME/auto-ltg-desktop.git

# 推送代码
git push -u origin main
```

---

## 启用 GitHub Actions 自动构建

推送代码后，GitHub Actions 会自动启用。每次推送代码或创建标签时，系统会自动构建各平台的安装包。

### 触发自动构建

#### 方式 1：推送时自动构建
每次推送代码到 `main` 分支时，Actions 会自动构建并上传构建产物。

#### 方式 2：创建发布版本（推荐）
创建版本标签来触发发布流程：

```bash
# 创建版本标签（例如 v1.0.0）
git tag -a v1.0.0 -m "Release version 1.0.0"

# 推送标签到 GitHub
git push origin v1.0.0
```

推送标签后，GitHub Actions 会：
1. 构建 macOS、Windows、Linux 三个平台的应用
2. 将构建结果上传到 GitHub Releases
3. 自动生成发布说明

### 查看构建状态

1. 访问 GitHub 仓库页面
2. 点击 **Actions** 标签
3. 查看构建进度和日志

### 下载构建产物

1. 等待构建完成（约 10-20 分钟）
2. 访问 **Releases** 页面
3. 下载对应平台的安装包

---

## 故障排除

### 推送失败：权限被拒绝

**问题**: `Permission denied` 或 `403 Forbidden`

**解决**: 
1. 检查是否已登录 GitHub
2. 使用 Personal Access Token 代替密码
3. 或配置 SSH 密钥

### Actions 未触发

**问题**: 推送代码后 Actions 没有运行

**解决**:
1. 检查 `.github/workflows/build.yml` 文件是否存在
2. 访问仓库 **Settings** → **Actions** → **General**
3. 确保 **Workflow permissions** 设置为 **Read and write permissions**

### 构建失败

**问题**: Actions 构建失败

**解决**:
1. 点击失败的 workflow 查看详细日志
2. 常见原因：
   - 缺少依赖：`npm install` 失败
   - 构建脚本错误
   - 资源限制：构建超时

---

## 配置 GitHub 仓库设置

推送代码后，建议进行以下设置：

### 1. 设置仓库描述和主题标签

1. 访问仓库主页
2. 点击右侧的 **⚙️ 齿轮图标**
3. 添加描述：`Auto-LTG - 字幕组统一工具平台 | Subtitle Group Toolkit Platform`
4. 添加主题标签：`electron`, `react`, `ffmpeg`, `subtitle`, `video-processing`

### 2. 启用 Issues 和 Discussions

1. 访问 **Settings** → **General**
2. 勾选 **Issues** 和 **Discussions**

### 3. 设置分支保护规则

1. 访问 **Settings** → **Branches**
2. 点击 **Add rule**
3. 设置 `main` 分支保护规则

---

## 快速命令参考

```bash
# 查看远程仓库
git remote -v

# 查看提交历史
git log --oneline

# 查看状态
git status

# 创建并推送标签
git tag -a v1.0.0 -m "Version 1.0.0"
git push origin v1.0.0

# 删除本地标签
git tag -d v1.0.0

# 删除远程标签
git push origin --delete v1.0.0

# 拉取最新代码
git pull origin main

# 强制推送（谨慎使用）
git push origin main --force
```

---

## 获取帮助

- [GitHub 官方文档](https://docs.github.com/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Electron Builder 文档](https://www.electron.build/)

如有问题，请在仓库中提交 Issue。
