const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

// 启动后端服务
function startBackend() {
  const backendPath = path.join(__dirname, '..', '..', 'video-toolkit-web');
  
  // 根据平台选择 Python 解释器路径
  const isWindows = process.platform === 'win32';
  const venvPython = isWindows 
    ? path.join(backendPath, 'venv', 'Scripts', 'python.exe')
    : path.join(backendPath, 'venv', 'bin', 'python');
  const startScript = path.join(backendPath, 'start.py');

  backendProcess = spawn(venvPython, [startScript], {
    cwd: backendPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ELECTRON_RUN: 'true' },
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });

  return new Promise((resolve) => {
    // 等待后端启动
    setTimeout(resolve, 2000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'Auto-LTG 视频工具箱',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f5f3ef',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 开发模式加载 localhost，生产模式加载构建文件
  const isDev = process.env.ELECTRON_DEV === 'true';

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'build', 'index.html'));
  }

  // 在外部浏览器打开链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC 处理：选择文件夹
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择文件夹',
  });

  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});

// IPC 处理：选择文件
ipcMain.handle('select-file', async (event, filters) => {
  const options = {
    properties: ['openFile'],
    title: '选择文件',
  };

  if (filters) {
    options.filters = filters;
  }

  const result = await dialog.showOpenDialog(mainWindow, options);

  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});

// IPC 处理：打开文件夹
ipcMain.handle('open-folder', async (event, folderPath) => {
  if (folderPath) {
    shell.openPath(folderPath);
  }
});

app.whenReady().then(async () => {
  // 启动后端
  await startBackend();

  // 创建窗口
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // 关闭后端进程
  if (backendProcess) {
    backendProcess.kill();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
