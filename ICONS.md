# 应用图标制作指南

Auto-LTG 需要以下图标文件用于应用打包：

## 需要的图标文件

| 文件路径 | 格式 | 尺寸 | 用途 |
|---------|------|------|------|
| `frontend/public/icon.icns` | Apple Icon Image | 多种尺寸 | macOS 应用图标 |
| `frontend/public/icon.ico` | Windows Icon | 256x256 | Windows 应用图标 |
| `frontend/public/icon.png` | PNG | 512x512 | Linux 应用图标 |

## 快速生成图标

### 方法 1：使用在线工具

1. **准备源图片**: 准备一张 1024x1024 像素的 PNG 图片（建议使用 `frontend/public/images/logo.png`）

2. **生成 macOS 图标 (.icns)**:
   - 访问 [iconverticons.com](https://iconverticons.com/online/)
   - 上传 PNG 图片
   - 下载 `.icns` 格式
   - 重命名为 `icon.icns`，放到 `frontend/public/` 目录

3. **生成 Windows 图标 (.ico)**:
   - 访问 [convertio.co](https://convertio.co/png-ico/) 或 [icoconverter.com](https://www.icoconverter.com/)
   - 上传 PNG 图片
   - 下载 `.ico` 格式
   - 重命名为 `icon.ico`，放到 `frontend/public/` 目录

4. **复制 PNG 图标**:
   - 将 `frontend/public/images/logo.png` 复制为 `frontend/public/icon.png`
   - 或使用 ImageMagick 调整尺寸：
     ```bash
     magick frontend/public/images/logo.png -resize 512x512 frontend/public/icon.png
     ```

### 方法 2：使用 macOS 命令行工具

如果你使用的是 macOS，可以使用以下命令：

```bash
cd frontend/public

# 使用 sips 和 iconutil 生成 .icns（需要准备多个尺寸的图标）
mkdir icon.iconset
sips -z 16 16     images/logo.png --out icon.iconset/icon_16x16.png
sips -z 32 32     images/logo.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     images/logo.png --out icon.iconset/icon_32x32.png
sips -z 64 64     images/logo.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   images/logo.png --out icon.iconset/icon_128x128.png
sips -z 256 256   images/logo.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   images/logo.png --out icon.iconset/icon_256x256.png
sips -z 512 512   images/logo.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   images/logo.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 images/logo.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o icon.icns
rm -rf icon.iconset

# 使用 ImageMagick 生成 .ico（如果没有安装，使用在线工具）
# brew install imagemagick
convert images/logo.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# 复制 PNG
cp images/logo.png icon.png
```

### 方法 3：使用 Node.js 脚本

安装 `icon-gen` 工具：

```bash
cd frontend
npm install --save-dev icon-gen
```

创建脚本 `scripts/generate-icons.js`：

```javascript
const icongen = require('icon-gen');

icongen('./public/images/logo.png', './public', {
  report: true,
  ico: {
    name: 'icon',
    sizes: [256]
  },
  icns: {
    name: 'icon',
    sizes: [512]
  }
})
.then((results) => {
  console.log('Icons generated:', results);
})
.catch((err) => {
  console.error('Error:', err);
});
```

运行脚本：

```bash
node scripts/generate-icons.js
```

## 图标设计建议

- **尺寸**: 源图片建议 1024x1024 像素
- **格式**: PNG 格式，透明背景
- **风格**: 简洁明了，在小尺寸下也能识别
- **颜色**: 与品牌色一致（Auto-LTG 使用绿灰色系 #7B8681）

## 验证图标

构建前检查图标是否存在：

```bash
cd /Users/yujiao.zhao/Desktop/auto-ltg

# 检查图标文件
ls -la frontend/public/icon.*

# 如果缺少图标，构建时会使用默认 Electron 图标
```

## 临时解决方案

如果没有准备好图标，可以先使用 Electron 默认图标，构建不会产生错误：

```bash
# 构建时忽略图标警告
cd frontend
npm run electron-build -- --mac 2>&1 | grep -v "icon"
```

> ⚠️ **注意**: 使用默认图标的应用在安装时可能不如自定义图标专业。
