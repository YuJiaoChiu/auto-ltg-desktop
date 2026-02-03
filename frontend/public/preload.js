const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 选择文件夹
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  // 选择文件
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
  // 打开文件夹
  openFolder: (path) => ipcRenderer.invoke('open-folder', path),
});
