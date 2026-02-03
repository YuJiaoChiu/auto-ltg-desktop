# Auto-LTG Backend

视频工具箱后端 API - 基于 Flask 的 6 合 1 视频处理服务

## 功能特性

### 1. 🤖 AI 批量重命名
使用 AI 智能重命名视频、音频、PDF 文件和文件夹，支持自定义 Prompt 模板和内容背景。

**API 端点:**
- `POST /api/rename/scan` - 扫描文件夹
- `POST /api/rename/generate` - AI 生成新名称
- `POST /api/rename/execute` - 执行重命名
- `POST /api/rename/update` - 手动更新名称

### 2. 📝 视频字幕整理
自动整理视频文件夹中的字幕文件到标准目录结构。

**API 端点:**
- `POST /api/subtitle/organize` - 整理字幕

### 3. ✂️ 视频智能分割
根据音频静音自动分割长视频，适合处理长课程视频。

**API 端点:**
- `POST /api/splitter/analyze` - 分析视频
- `POST /api/splitter/split` - 分割视频

### 4. 🎬 批量片头添加
批量为视频添加片头，支持保持目录结构。

**API 端点:**
- `POST /api/intro/analyze` - 分析文件
- `POST /api/intro/process` - 处理片头添加

### 5. 📚 课程团购文案生成器
四阶段流水线：采集 → 策划 → 改写 → 出图

**API 端点:**
- `POST /api/copywriter/scrape` - 抓取网页内容
- `POST /api/copywriter/set-content` - 手动设置内容
- `POST /api/copywriter/generate-titles` - 生成标题
- `POST /api/copywriter/generate-copy` - 生成文案
- `POST /api/copywriter/generate-cover` - 生成营销封面

### 6. 🗜️ 视频压缩
批量压缩视频，支持文件夹穿透、实时进度、下载功能。

**API 端点:**
- `POST /api/compress/scan` - 扫描视频
- `POST /api/compress/create-tasks` - 创建压缩任务
- `GET /api/compress/tasks` - 获取任务列表
- `POST /api/compress/cancel/<task_id>` - 取消任务
- `POST /api/compress/clear` - 清理已完成
- `GET /api/compress/download/<task_id>` - 下载压缩后的视频
- **WebSocket**: `start_compression` - 开始压缩（实时进度）

## 技术栈

- **后端框架**: Python + Flask + Flask-SocketIO
- **视频处理**: FFmpeg
- **AI 服务**: OpenAI API (支持自定义 Base URL)
- **异步通信**: SocketIO (实时进度)

## 安装要求

- Python 3.8+
- FFmpeg (必须安装并添加到 PATH)

### 安装 FFmpeg

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

## 安装步骤

1. 创建虚拟环境
```bash
cd video-toolkit-web
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

2. 安装依赖
```bash
pip install -r requirements.txt
```

3. 启动应用
```bash
python start.py
```

或使用 Flask 命令：
```bash
flask --app app.app run --port=5001
```

4. 访问应用
启动后会自动打开浏览器访问 `http://127.0.0.1:5001`

## 项目结构

```
video-toolkit-web/
├── app/
│   ├── __init__.py
│   ├── app.py                    # Flask 主应用 + API 路由
│   └── modules/                  # 功能模块
│       ├── __init__.py
│       ├── ai_renamer.py         # AI 重命名
│       ├── subtitle_organizer.py # 字幕整理
│       ├── video_splitter.py     # 视频分割
│       ├── intro_adder.py        # 片头添加
│       ├── copywriter.py         # 文案生成
│       └── video_compressor.py   # 视频压缩
├── uploads/                      # 上传目录（临时文件）
├── outputs/                      # 输出目录
├── venv/                         # Python 虚拟环境
├── start.py                      # 启动脚本
├── requirements.txt              # 依赖
└── README.md                     # 说明文档
```

## 配置说明

### 应用配置

在 `app/app.py` 中修改配置：

```python
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'outputs'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 * 1024  # 16GB 最大文件
app.config['SECRET_KEY'] = 'your-secret-key'
```

### AI API 配置

支持 OpenAI API 和兼容的第三方服务：
- 支持自定义 API Base URL
- 支持多种模型（GPT-4, GPT-3.5, Gemini 等）
- 支持代理设置

## API 响应格式

所有 API 返回 JSON 格式：

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

或错误时：

```json
{
  "success": false,
  "error": "错误信息"
}
```

## WebSocket 事件

### 视频压缩实时进度

**客户端发送:**
```javascript
socket.emit('start_compression', {
  task_id: 'uuid',
  input_path: '/path/to/video.mp4',
  settings: { ... }
})
```

**服务端推送:**
```javascript
socket.on('compression_progress', (data) => {
  console.log(data.progress)  // 0-100
  console.log(data.status)    // 'processing' | 'completed' | 'error'
})
```

## 注意事项

1. **FFmpeg 必须安装**: 视频分割、片头添加、压缩功能依赖 FFmpeg
2. **API Key**: AI 重命名和文案生成功能需要 OpenAI API Key
3. **文件备份**: 建议在操作前备份重要文件
4. **大文件处理**: 视频处理可能需要较长时间，请耐心等待
5. **端口配置**: 默认使用 5001 端口，可在 `start.py` 中修改

## 依赖列表

```
flask>=3.0.0
flask-socketio>=5.3.0
openai>=1.0.0
httpx>=0.24.0
werkzeug>=3.0.0
requests>=2.28.0
beautifulsoup4>=4.11.0
lxml>=4.9.0
pillow>=9.0.0
google-genai>=0.3.0
python-socketio>=5.7.0
eventlet>=0.33.0
playwright>=1.40.0
```

## 更新日志

### v1.0.0 (2026-01-31)
- ✨ 初始版本发布
- 🤖 AI 批量重命名
- 📝 视频字幕整理
- ✂️ 视频智能分割
- 🎬 批量片头添加
- 📚 课程团购文案生成
- 🗜️ 视频压缩（带实时进度）

## 许可证

与原项目保持一致
