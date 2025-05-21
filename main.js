const { app, BrowserWindow, ipcMain, dialog, autoUpdater } = require('electron/main')
const path = require('node:path')
const calc = require('./calc')
const fs = require('fs')

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

// 处理保存Excel文件的请求
ipcMain.on('save-excel', (event, data) => {
    dialog.showSaveDialog({
        title: '保存Excel文件',
        defaultPath: data.defaultPath,
        filters: [
            { name: 'Excel文件', extensions: ['xlsx'] }
        ]
    }).then(result => {
        if (!result.canceled) {
            event.reply('save-excel-response', result.filePath);
        } else {
            event.reply('save-excel-response', null);
        }
    }).catch(err => {
        console.error('保存对话框错误:', err);
        event.reply('save-excel-response', null);
    });
});

// 处理写入Excel文件的请求
ipcMain.on('write-excel', (event, data) => {
    try {
        fs.writeFileSync(data.filePath, Buffer.from(data.buffer));
        event.reply('write-excel-response', true);
    } catch (err) {
        console.error('写入文件错误:', err);
        event.reply('write-excel-response', false);
    }
});