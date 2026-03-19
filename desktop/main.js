const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let pythonProcess;

// Prevent EPIPE crashes
process.on('uncaughtException', (err) => {
  if (err.code === 'EPIPE') return;
  console.error('Uncaught Exception:', err);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    frame: false,
    titleBarStyle: 'hidden',
    title: "LabAssistant Desktop",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Window control IPC
  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window-close', () => mainWindow.close());

  // In development, load from Vite
  // In production, we'd load the build/index.html
  const isDev = !app.isPackaged;
  const startUrl = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../frontend/dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
    }
  });
}

function startBackend() {
  const isDev = !app.isPackaged;
  const isWin = process.platform === 'win32';
  
  // Try bundled executable first (for production)
  const exeName = isWin ? 'LabAssistantBackend.exe' : 'LabAssistantBackend';
  const bundledPath = isDev 
    ? path.join(__dirname, '../backend/dist', exeName)
    : path.join(process.resourcesPath, 'backend', exeName);

  let pythonPath;
  let args = [];

  if (fs.existsSync(bundledPath)) {
    console.log(`Using bundled backend: ${bundledPath}`);
    pythonPath = bundledPath;
    args = [];
  } else {
    // Fallback to dev venv
    const venvPath = isWin 
      ? path.join(__dirname, '../backend/venv/Scripts/python.exe')
      : path.join(__dirname, '../backend/venv/bin/python3');
    
    pythonPath = isDev && fs.existsSync(venvPath) ? venvPath : 'python3';
    args = [path.join(__dirname, '../backend/main.py')];
    console.log(`Using python fallback: ${pythonPath}`);
  }

  pythonProcess = spawn(pythonPath, args, {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '0' }
  });

  pythonProcess.stdout.on('data', (data) => {
    const msg = data.toString();
    if (mainWindow) mainWindow.webContents.send('backend-log', msg);
  });

  pythonProcess.stderr.on('data', (data) => {
    const msg = data.toString();
    if (mainWindow) mainWindow.webContents.send('backend-err', msg);
  });

  pythonProcess.on('close', (code) => {
    if (mainWindow) mainWindow.webContents.send('backend-log', `Backend process exited with code ${code}`);
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});
