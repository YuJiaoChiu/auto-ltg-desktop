# Auto-LTG Frontend

React + Electron 桌面应用前端 - 字幕组统一工具平台

## 功能模块

1. **Splash Screen** - 启动画面（吉娃娃 Logo）
2. **AI Rename** - AI 智能重命名
3. **Video Split** - 视频分割
4. **Add Intro** - 添加片头
5. **Subtitles** - 字幕整理
6. **Compression** - 视频压缩
7. **Course Copy** - 课程文案生成
8. **Settings** - 设置

## 设计风格

- **主色调**: 绿灰色系 (#7B8681, #E0E5E1)
- **字体**: Playfair Display (标题), Inter (UI), Space Mono (代码)
- **设计理念**: 复古优雅，专业简洁

## 安装和运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm start

# 启动 Electron 开发模式
npm run electron-dev

# 构建生产版本
npm run build

# 构建 Electron 应用
npm run electron-build
```

## 项目结构

```
src/
├── components/      # 通用组件
│   ├── Sidebar.jsx
│   ├── Button.jsx
│   ├── Input.jsx
│   ├── FileItem.jsx
│   ├── Progress.jsx
│   ├── LogArea.jsx
│   ├── DropZone.jsx
│   ├── Asterisk.jsx
│   ├── SelectionCard.jsx
│   └── index.js
├── pages/          # 页面组件
│   ├── SplashScreen.jsx
│   ├── AIRename.jsx
│   ├── VideoSplit.jsx
│   ├── AddIntro.jsx
│   ├── Subtitles.jsx
│   ├── Compression.jsx
│   ├── CourseCopy.jsx
│   ├── Statistics.jsx
│   ├── Settings.jsx
│   └── index.js
├── contexts/       # React Context
│   ├── SettingsContext.jsx
│   └── PageStateContext.jsx
├── hooks/          # 自定义 Hooks
│   └── useLanguage.js
├── services/       # API 服务
│   └── api.js
├── styles/         # 样式文件
│   └── global.css
├── App.jsx
└── index.js
```

## 技术栈

- React 18
- React Router 6
- Electron
- CSS Variables (设计系统)

## 后端通信

前端通过 REST API 和 WebSocket 与后端通信：
- **API 地址**: `http://localhost:5001`（开发时通过 proxy 配置）
- **WebSocket**: 用于实时进度推送（如视频压缩）

## 环境变量

创建 `.env` 文件配置环境变量：

```env
# API 基础地址
REACT_APP_API_URL=http://localhost:5001

# Electron 模式标志
ELECTRON_DEV=true
```

## 构建配置

Electron 构建配置位于 `package.json`：

```json
{
  "build": {
    "appId": "com.autoltg.app",
    "productName": "Auto-LTG",
    "directories": {
      "output": "dist"
    },
    "files": [
      "build/**/*",
      "public/electron.js"
    ],
    "extraResources": [
      {
        "from": "../video-toolkit-web",
        "to": "video-toolkit-web",
        "filter": ["**/*", "!venv/**/*", "!__pycache__/**/*"]
      }
    ],
    "mac": {
      "category": "public.app-category.video",
      "icon": "public/icon.icns"
    }
  }
}
```

## 作者

by Link
