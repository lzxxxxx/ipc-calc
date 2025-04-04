const { app, BrowserWindow, ipcMain, dialog, autoUpdater } = require('electron/main')
const path = require('node:path')
const calc = require('./calc')

// 引入 electron-reload
require('electron-reload')(path.join(__dirname), {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
})

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
        contextIsolation: false,
        enableRemoteModule: false,
        nodeIntegration: true, // 允许在渲染进程中使用 require
    }
  })

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  // 或者禁用自动检查
  autoUpdater.autoDownload = false; // 禁用自动下载更新
  autoUpdater.autoInstallOnAppQuit = false; // 禁用退出时自动安装更新

  createWindow()

  //兼容macOS
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})