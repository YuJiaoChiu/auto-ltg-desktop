#!/usr/bin/env node
/**
 * Auto-LTG 跨平台构建脚本
 * 支持 macOS、Windows、Linux
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PLATFORM = process.platform;
const TARGET = process.argv[2] || 'current'; // current, mac, win, linux, all

console.log('🎬 Auto-LTG 跨平台构建工具');
console.log('==========================');
console.log(`当前平台: ${PLATFORM}`);
console.log(`构建目标: ${TARGET}`);
console.log('');

// 检查环境
function checkEnvironment() {
  console.log('🔍 检查构建环境...');
  
  // 检查 Node.js
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    console.log(`✅ Node.js: ${nodeVersion}`);
  } catch {
    console.error('❌ Node.js 未安装');
    process.exit(1);
  }
  
  // 检查 Python
  try {
    const pythonCmd = PLATFORM === 'win32' ? 'python' : 'python3';
    const pythonVersion = execSync(`${pythonCmd} --version`, { encoding: 'utf-8' }).trim();
    console.log(`✅ Python: ${pythonVersion}`);
  } catch {
    console.error('❌ Python 未安装');
    process.exit(1);
  }
  
  // 检查 FFmpeg
  try {
    const ffmpegVersion = execSync('ffmpeg -version', { encoding: 'utf-8' }).split('\n')[0];
    console.log(`✅ FFmpeg: ${ffmpegVersion}`);
  } catch {
    console.warn('⚠️ FFmpeg 未安装（构建时可选，但运行时必需）');
  }
  
  console.log('');
}

// 安装依赖
function installDependencies() {
  console.log('📦 安装前端依赖...');
  const frontendPath = path.join(__dirname, 'frontend');
  execSync('npm install', { cwd: frontendPath, stdio: 'inherit' });
  console.log('');
}

// 构建应用
function buildApp() {
  const frontendPath = path.join(__dirname, 'frontend');
  
  console.log('🔨 开始构建...');
  console.log('');
  
  let buildCommand = 'npm run electron-build --';
  
  switch (TARGET) {
    case 'mac':
      buildCommand += ' --mac';
      break;
    case 'win':
      buildCommand += ' --win';
      break;
    case 'linux':
      buildCommand += ' --linux';
      break;
    case 'all':
      buildCommand += ' --mac --win --linux';
      break;
    case 'current':
    default:
      // 不添加平台参数，electron-builder 会自动检测当前平台
      break;
  }
  
  try {
    execSync(buildCommand, { cwd: frontendPath, stdio: 'inherit' });
    console.log('');
    console.log('✅ 构建完成！');
    
    // 显示输出路径
    const distPath = path.join(frontendPath, 'dist');
    if (fs.existsSync(distPath)) {
      console.log('');
      console.log('📁 构建输出目录:');
      console.log(`   ${distPath}`);
      console.log('');
      
      // 列出构建的文件
      const files = fs.readdirSync(distPath);
      if (files.length > 0) {
        console.log('📦 生成的文件:');
        files.forEach(file => {
          const filePath = path.join(distPath, file);
          const stats = fs.statSync(filePath);
          const size = formatSize(stats.size);
          console.log(`   - ${file} (${size})`);
        });
      }
    }
  } catch (error) {
    console.error('❌ 构建失败:', error.message);
    process.exit(1);
  }
}

// 格式化文件大小
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 显示帮助
function showHelp() {
  console.log('使用方法:');
  console.log('  node build.js [target]');
  console.log('');
  console.log('参数:');
  console.log('  current  - 构建当前平台版本 (默认)');
  console.log('  mac      - 构建 macOS 版本 (.dmg)');
  console.log('  win      - 构建 Windows 版本 (.exe)');
  console.log('  linux    - 构建 Linux 版本 (.AppImage/.deb)');
  console.log('  all      - 构建所有平台版本');
  console.log('');
  console.log('示例:');
  console.log('  node build.js           # 构建当前平台');
  console.log('  node build.js mac       # 构建 macOS 版本');
  console.log('  node build.js win       # 构建 Windows 版本');
  console.log('');
}

// 主函数
function main() {
  if (process.argv.includes('-h') || process.argv.includes('--help')) {
    showHelp();
    return;
  }
  
  checkEnvironment();
  installDependencies();
  buildApp();
  
  console.log('');
  console.log('🎉 构建流程完成！');
}

main();
