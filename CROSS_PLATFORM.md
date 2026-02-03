# 跨平台支持指南

Auto-LTG 支持 **macOS**、**Windows** 和 **Linux** 三大平台。

## 支持的平台

| 平台 | 最低版本 | 架构 | 状态 |
|------|---------|------|------|
| macOS | 10.14 (Mojave) | x64, arm64 (Apple Silicon) | ✅ 完全支持 |
| Windows | Windows 10 | x64 | ✅ 完全支持 |
| Linux | Ubuntu 18.04+ | x64 | ✅ 支持 |

## 各平台安装说明

### macOS

#### 环境准备
```bash
# 安装 Homebrew（如果还没有）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装依赖
brew install node python@3.11 ffmpeg
```

#### 构建
```bash
# 开发模式
npm run electron-dev

# 生产构建
cd frontend
npm run electron-build -- --mac

# 或者使用构建脚本
cd ..
node build.js mac
```

#### 输出文件
- `Auto-LTG-x.x.x.dmg` - 标准安装包
- `Auto-LTG-x.x.x-arm64.dmg` - Apple Silicon 版本
- `Auto-LTG-x.x.x-mac.zip` - 便携版本

---

### Windows

#### 环境准备

**方式一：使用 winget（推荐）**
```powershell
# 安装 Node.js
winget install OpenJS.NodeJS

# 安装 Python
winget install Python.Python.3.11

# 安装 FFmpeg
winget install FFmpeg
```

**方式二：手动下载安装**
- [Node.js](https://nodejs.org/) (LTS 版本)
- [Python](https://python.org/) (3.8+)
- [FFmpeg](https://ffmpeg.org/download.html) (添加到系统 PATH)

#### 构建
```powershell
# 开发模式
cd frontend
npm install
npm run electron-dev

# 生产构建
npm run electron-build -- --win

# 或者使用构建脚本
cd ..
node build.js win
```

#### 输出文件
- `Auto-LTG Setup x.x.x.exe` - 安装程序（推荐）
- `Auto-LTG x.x.x.exe` - 便携版本（无需安装）

---

### Linux (Ubuntu/Debian)

#### 环境准备
```bash
# 更新包列表
sudo apt update

# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 Python
sudo apt install -y python3 python3-pip python3-venv

# 安装 FFmpeg
sudo apt install -y ffmpeg
```

#### 构建
```bash
# 开发模式
cd frontend
npm install
npm run electron-dev

# 生产构建
npm run electron-build -- --linux

# 或者使用构建脚本
cd ..
node build.js linux
```

#### 输出文件
- `Auto-LTG-x.x.x.AppImage` - 通用 Linux 可执行文件
- `Auto-LTG_x.x.x_amd64.deb` - Debian/Ubuntu 安装包

---

## 跨平台注意事项

### 1. 路径处理

代码中已经使用跨平台的路径处理方式：

```javascript
// ✅ 推荐：使用 path.join
const path = require('path');
const filePath = path.join('folder', 'file.txt');

// ✅ 推荐：使用 Electron 的 app.getPath
const { app } = require('electron');
const userData = app.getPath('userData');
```

```python
# ✅ 推荐：使用 os.path.join 或 pathlib
import os
from pathlib import Path

# 方式一
file_path = os.path.join('folder', 'file.txt')

# 方式二（推荐）
file_path = Path('folder') / 'file.txt'
```

### 2. Python 虚拟环境

不同平台的虚拟环境路径不同：

| 平台 | Python 路径 | 激活命令 |
|------|------------|---------|
| macOS/Linux | `venv/bin/python` | `source venv/bin/activate` |
| Windows | `venv\Scripts\python.exe` | `venv\Scripts\activate.bat` |

Electron 中已自动处理：
```javascript
const isWindows = process.platform === 'win32';
const venvPython = isWindows 
  ? path.join(backendPath, 'venv', 'Scripts', 'python.exe')
  : path.join(backendPath, 'venv', 'bin', 'python');
```

### 3. 命令执行

```javascript
// ✅ 推荐：使用 cross-spawn 或检查平台
const { spawn } = require('child_process');

const isWindows = process.platform === 'win32';
const cmd = isWindows ? 'cmd' : 'bash';
const args = isWindows ? ['/c', 'command'] : ['-c', 'command'];
```

### 4. 文件路径分隔符

```javascript
// ✅ 推荐：使用 path.sep
const path = require('path');
console.log(path.sep); // macOS/Linux: '/', Windows: '\'
```

### 5. FFmpeg 路径

确保 FFmpeg 已添加到系统 PATH：

```bash
# 验证 FFmpeg 安装
ffmpeg -version

# macOS/Linux：添加到 .zshrc 或 .bashrc
export PATH="/usr/local/bin:$PATH"

# Windows：添加到系统环境变量
# 设置 → 系统 → 关于 → 高级系统设置 → 环境变量 → Path
```

---

## CI/CD 跨平台构建

使用 GitHub Actions 可以同时构建多平台版本：

```yaml
# .github/workflows/build.yml
name: Build Cross-Platform

on: [push]

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install FFmpeg (macOS)
        if: runner.os == 'macOS'
        run: brew install ffmpeg
      
      - name: Install FFmpeg (Windows)
        if: runner.os == 'Windows'
        run: choco install ffmpeg
      
      - name: Install FFmpeg (Linux)
        if: runner.os == 'Linux'
        run: sudo apt-get install ffmpeg
      
      - name: Build
        run: node build.js current
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-${{ matrix.os }}
          path: frontend/dist/
```

---

## 常见问题

### Q: Windows 上构建失败，提示找不到 Python
**A:** 确保 Python 已添加到系统 PATH，或使用 `py` 命令。

### Q: Linux 上 AppImage 无法运行
**A:** 添加执行权限：
```bash
chmod +x Auto-LTG-x.x.x.AppImage
```

### Q: macOS 上提示 "无法打开，因为无法验证开发者"
**A:** 需要签名或用户手动允许：
```bash
# 临时绕过（不推荐长期使用）
xattr -cr /Applications/Auto-LTG.app
```

### Q: 后端服务无法启动
**A:** 检查：
1. Python 虚拟环境是否存在
2. 依赖是否正确安装
3. 端口 5001 是否被占用

---

## 测试矩阵

| 功能 | macOS | Windows | Linux |
|------|-------|---------|-------|
| AI 重命名 | ✅ | ✅ | ✅ |
| 视频分割 | ✅ | ✅ | ✅ |
| 片头添加 | ✅ | ✅ | ✅ |
| 字幕整理 | ✅ | ✅ | ✅ |
| 文案生成 | ✅ | ✅ | ✅ |
| 视频压缩 | ✅ | ✅ | ✅ |
| 文件夹选择 | ✅ | ✅ | ✅ |
| 文件拖拽 | ✅ | ✅ | ✅ |

---

如需更多帮助，请提交 Issue。
