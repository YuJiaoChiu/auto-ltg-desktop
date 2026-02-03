# Auto-LTG | 字幕组统一工具平台

<p align="center">
  <img src="frontend/public/images/logo.png" width="120" alt="Auto-LTG Logo">
</p>

<p align="center">
  <b>一款专为字幕组设计的桌面端视频处理工具集</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platforms">
  <img src="https://img.shields.io/badge/electron-%5E40.1.0-9cf" alt="Electron">
  <img src="https://img.shields.io/badge/react-%5E18.2.0-61dafb" alt="React">
  <img src="https://img.shields.io/badge/python-%5E3.8-3776ab" alt="Python">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#下载安装">下载安装</a> •
  <a href="#技术栈">技术栈</a> •
  <a href="#安装指南">安装指南</a> •
  <a href="#使用说明">使用说明</a> •
  <a href="#跨平台支持">跨平台支持</a> •
  <a href="#开发指南">开发指南</a>
</p>

---

## 📥 下载安装

### 最新版本

| 平台 | 下载链接 | 说明 |
|------|---------|------|
| **macOS** | [Auto-LTG-macOS.dmg](https://github.com/YuJiaoChiu/auto-ltg-desktop/releases/latest) | 支持 Intel & Apple Silicon |
| **Windows** | [Auto-LTG-Windows.exe](https://github.com/YuJiaoChiu/auto-ltg-desktop/releases/latest) | Windows 10/11 安装版 |
| **Windows (便携版)** | [Auto-LTG-Windows-Portable.exe](https://github.com/YuJiaoChiu/auto-ltg-desktop/releases/latest) | 无需安装，直接使用 |
| **Linux** | [Auto-LTG-Linux.AppImage](https://github.com/YuJiaoChiu/auto-ltg-desktop/releases/latest) | Ubuntu/Debian 通用 |

> 💡 **提示**: 如果上方链接无法访问，请前往 [Releases 页面](https://github.com/YuJiaoChiu/auto-ltg-desktop/releases) 查看最新版本。

### 系统要求

- **macOS**: macOS 10.14+ (Mojave 或更新版本)
- **Windows**: Windows 10 或更新版本
- **Linux**: Ubuntu 18.04+ 或同类发行版

### 快速开始

1. 下载对应平台的安装包
2. **macOS**: 打开 `.dmg` 文件，将应用拖入 Applications 文件夹
3. **Windows**: 运行 `.exe` 安装程序，按向导完成安装
4. **Linux**: 赋予 AppImage 执行权限后双击运行

```bash
# Linux 用户可能需要添加执行权限
chmod +x Auto-LTG-*.AppImage
```

---

## ✨ 功能特性

Auto-LTG 整合了字幕组工作流程中的 6 大核心工具：

| 功能 | 描述 | 状态 |
|------|------|------|
| 🤖 **AI 批量重命名** | 使用 AI 智能重命名视频、音频、PDF 文件和文件夹 | ✅ 可用 |
| 📝 **视频字幕整理** | 自动整理字幕文件到标准目录结构 | ✅ 可用 |
| ✂️ **视频智能分割** | 根据音频静音自动分割长视频 | ✅ 可用 |
| 🎬 **批量片头添加** | 批量为视频添加片头 | ✅ 可用 |
| 📚 **课程文案生成** | AI 生成课程团购文案和封面 | ✅ 可用 |
| 🗜️ **视频压缩** | 批量压缩视频，支持实时进度 | ✅ 可用 |

## 🎨 设计风格

- **主色调**: 绿灰色系 (#7B8681, #E0E5E1)
- **字体**: Playfair Display (标题), Inter (UI), Space Mono (代码)
- **设计理念**: 复古优雅，专业简洁

## 🏗️ 技术栈

### 前端
- **框架**: React 18 + React Router 6
- **桌面端**: Electron
- **样式**: CSS Variables (设计系统)
- **状态管理**: React Context API
- **构建工具**: Create React App

### 后端
- **框架**: Flask + Flask-SocketIO
- **视频处理**: FFmpeg
- **AI 服务**: OpenAI API (支持自定义 Base URL / Google Gemini)
- **异步通信**: WebSocket (实时进度推送)

## 📁 项目结构

```
auto-ltg/
├── .gitignore                    # Git 忽略配置
├── README.md                     # 项目说明文档
│
├── frontend/                     # React + Electron 前端
│   ├── package.json              # NPM 依赖配置
│   ├── public/
│   │   ├── electron.js           # Electron 主进程入口
│   │   ├── preload.js            # 预加载脚本（安全通信）
│   │   ├── index.html            # HTML 模板
│   │   └── images/logo.png       # 应用 Logo
│   └── src/
│       ├── App.jsx               # 主应用组件
│       ├── components/           # 通用 UI 组件
│       │   ├── Sidebar.jsx       # 侧边导航
│       │   ├── Button.jsx        # 按钮组件
│       │   ├── Input.jsx         # 输入框组件
│       │   ├── DropZone.jsx      # 拖拽上传区
│       │   ├── FileItem.jsx      # 文件列表项
│       │   ├── Progress.jsx      # 进度条
│       │   ├── LogArea.jsx       # 日志输出区
│       │   ├── SelectionCard.jsx # 功能选择卡片
│       │   ├── Asterisk.jsx      # 装饰组件
│       │   └── index.js          # 组件导出
│       ├── pages/                # 页面组件
│       │   ├── SplashScreen.jsx  # 启动画面
│       │   ├── AIRename.jsx      # AI 重命名页面
│       │   ├── VideoSplit.jsx    # 视频分割页面
│       │   ├── AddIntro.jsx      # 片头添加页面
│       │   ├── Subtitles.jsx     # 字幕整理页面
│       │   ├── Compression.jsx   # 视频压缩页面
│       │   ├── CourseCopy.jsx    # 文案生成页面
│       │   ├── Statistics.jsx    # 统计页面
│       │   ├── Settings.jsx      # 设置页面
│       │   └── index.js          # 页面导出
│       ├── contexts/             # React Context
│       │   ├── SettingsContext.jsx   # 全局设置
│       │   └── PageStateContext.jsx  # 页面状态
│       ├── hooks/                # 自定义 Hooks
│       │   └── useLanguage.js    # 语言切换 Hook
│       ├── services/             # 服务层
│       │   └── api.js            # API 封装
│       ├── styles/               # 样式文件
│       │   └── global.css        # 全局样式
│       └── index.js              # 应用入口
│
└── video-toolkit-web/            # Flask 后端 API
    ├── app/
    │   ├── __init__.py           # 应用初始化
    │   ├── app.py                # Flask 主应用 + API 路由
    │   └── modules/              # 功能模块
    │       ├── __init__.py
    │       ├── ai_renamer.py     # AI 重命名模块
    │       ├── subtitle_organizer.py  # 字幕整理模块
    │       ├── video_splitter.py # 视频分割模块
    │       ├── intro_adder.py    # 片头添加模块
    │       ├── copywriter.py     # 文案生成模块
    │       └── video_compressor.py    # 视频压缩模块
    ├── uploads/                  # 上传文件临时目录
    ├── outputs/                  # 输出文件目录
    ├── venv/                     # Python 虚拟环境
    ├── start.py                  # 启动脚本
    ├── requirements.txt          # Python 依赖
    └── README.md                 # 后端说明文档
```

## 🚀 安装指南

### 环境要求

- **Node.js** >= 18.x
- **Python** >= 3.8
- **FFmpeg** (必须安装并添加到 PATH)

### 1. 安装 FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
```powershell
winget install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

### 2. 克隆项目

```bash
git clone <repository-url>
cd auto-ltg
```

### 3. 安装前端依赖

```bash
cd frontend
npm install
```

### 4. 安装后端依赖

```bash
cd ../video-toolkit-web
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 📖 使用说明

### 开发模式

**启动后端服务:**
```bash
cd video-toolkit-web
python start.py
```
服务将运行在 `http://127.0.0.1:5001`

**启动前端开发服务器:**
```bash
cd frontend
npm start
```
前端将运行在 `http://localhost:3000`

**启动 Electron 桌面应用:**
```bash
cd frontend
npm run electron-dev
```

### 生产构建

#### 跨平台构建支持

本项目支持为 **Windows**、**macOS** 和 **Linux** 构建桌面应用。

**构建桌面应用:**
```bash
cd frontend
npm run electron-build
```

构建后的应用位于 `frontend/dist/` 目录。

#### 平台特定构建

**macOS (dmg):**
```bash
cd frontend
npm run electron-build -- --mac
```

**Windows (exe):**
```bash
cd frontend
npm run electron-build -- --win
```

**Linux (AppImage):**
```bash
cd frontend
npm run electron-build -- --linux
```

#### 构建配置说明

在 `frontend/package.json` 中已配置多平台支持：

```json
{
  "build": {
    "mac": {
      "category": "public.app-category.video",
      "icon": "public/icon.icns"
    },
    "win": {
      "target": "nsis",
      "icon": "public/icon.ico"
    },
    "linux": {
      "target": "AppImage",
      "category": "AudioVideo"
    }
  }
}
```

**注意:**
- 在 Windows 上构建 Windows 版本需要 Windows 环境
- 在 macOS 上构建 macOS 版本需要 macOS 环境（或签名证书）
- 跨平台构建建议使用 CI/CD（如 GitHub Actions）

## 🔧 开发指南

### 前端开发

```bash
cd frontend

# 启动开发服务器
npm start

# 运行测试
npm test

# 构建生产版本
npm run build

# Electron 开发模式
npm run electron-dev

# 构建 Electron 应用
npm run electron-build
```

### 后端开发

```bash
cd video-toolkit-web

# 激活虚拟环境
source venv/bin/activate

# 启动服务
python start.py

# 或使用 Flask 命令
flask --app app.app run --port=5001
```

### API 接口

后端提供 RESTful API 和 WebSocket 实时通信：

#### AI 重命名
- `POST /api/rename/scan` - 扫描文件夹
- `POST /api/rename/generate` - AI 生成新名称
- `POST /api/rename/execute` - 执行重命名

#### 视频压缩
- `POST /api/compress/scan` - 扫描视频
- `POST /api/compress/create-tasks` - 创建压缩任务
- `WebSocket: start_compression` - 开始压缩（实时进度）

#### 其他功能
详见 `video-toolkit-web/app/app.py` 中的路由定义。

## ⚙️ 配置说明

### 前端配置

前端配置存储在浏览器的 `localStorage` 中：
- `theme`: 主题模式 (`light` / `dark`)
- `language`: 语言设置 (`zh` / `en`)

### 后端配置

后端配置通过环境变量或直接在代码中修改：

```python
# app/app.py
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'outputs'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 * 1024  # 16GB
```

## ⚠️ 注意事项

1. **FFmpeg 必须安装**: 视频分割、片头添加、压缩功能依赖 FFmpeg
2. **API Key 配置**: AI 重命名和文案生成功能需要 OpenAI API Key（支持自定义 Base URL）
3. **文件备份**: 建议在操作前备份重要文件
4. **大文件处理**: 视频处理可能需要较长时间，请耐心等待
5. **端口占用**: 默认使用 5001 端口，如被占用请修改 `start.py`

## 🖥️ 跨平台支持

Auto-LTG 支持 **macOS**、**Windows** 和 **Linux** 三大主流平台。

| 平台 | 最低版本 | 安装包格式 | 状态 |
|------|---------|-----------|------|
| macOS | 10.14+ | `.dmg` | ✅ 支持 Intel & Apple Silicon |
| Windows | Windows 10 | `.exe` (安装版/便携版) | ✅ 完全支持 |
| Linux | Ubuntu 18.04+ | `.AppImage`, `.deb` | ✅ 支持 |

### 快速构建

```bash
# 使用构建脚本（推荐）
node build.js        # 构建当前平台
node build.js mac    # 构建 macOS
node build.js win    # 构建 Windows
node build.js linux  # 构建 Linux
node build.js all    # 构建所有平台
```

更多跨平台构建详情，请参阅 [CROSS_PLATFORM.md](./CROSS_PLATFORM.md)。

---

## 📝 更新日志

### v1.0.0 (2026-02)
- ✨ 初始版本发布
- 🤖 AI 批量重命名
- 📝 视频字幕整理
- ✂️ 视频智能分割
- 🎬 批量片头添加
- 📚 课程团购文案生成
- 🗜️ 视频压缩（带实时进度）

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 LICENSE 文件

## 👨‍💻 作者

**Link** - 设计与开发

---

<p align="center">
  Made with ❤️ for Subtitle Groups
</p>
