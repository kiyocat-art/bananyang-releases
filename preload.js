const { contextBridge, ipcRenderer, webUtils } = require('electron');

// [STARTUP RACE FIX] Buffer load-workspace events that arrive before React mounts.
// main.js sends load-workspace on did-finish-load, but React's useEffect (which
// registers onLoadWorkspace) runs after the first render — after did-finish-load.
// Without buffering, the IPC message is sent before the listener exists and is lost.
// Supports multiple pending items (e.g. when multiple files are opened simultaneously).
let _pendingLoadWorkspaceQueue = [];
let _loadWorkspaceCallback = null;
ipcRenderer.on('load-workspace', (_event, filePath, fileContent) => {
    if (_loadWorkspaceCallback) {
        _loadWorkspaceCallback(filePath, fileContent);
    } else {
        _pendingLoadWorkspaceQueue.push({ filePath, fileContent });
    }
});

const saveContentToFile = async (filePath, content) => {
  try {
    const CHUNK_SIZE = 1024 * 1024 * 5; // 5MB chunks
    const totalChunks = Math.ceil(content.length / CHUNK_SIZE);

    // Creates filePath.tmp — original file is untouched until save-file-end
    await ipcRenderer.invoke('save-file-start', filePath);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = content.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await ipcRenderer.invoke('save-file-chunk', filePath, chunk);
    }

    // Atomically renames filePath.tmp → filePath
    await ipcRenderer.invoke('save-file-end', filePath);
    return true;
  } catch (error) {
    console.error('Chunked save failed:', error);
    // save-file-chunk already cleans up .tmp on failure;
    // save-file-end cleans up if rename fails — no further action needed.
    return false;
  }
};

// Binary (ZIP) chunked save for .nyang container format
const saveBinaryToFile = async (filePath, uint8) => {
  try {
    const CHUNK_SIZE = 1024 * 1024 * 5; // 5MB chunks
    await ipcRenderer.invoke('save-binary-file-start', filePath);

    for (let i = 0; i < uint8.length; i += CHUNK_SIZE) {
      const slice = uint8.subarray(i, Math.min(i + CHUNK_SIZE, uint8.length));
      // Encode chunk as base64 to pass through contextBridge (Uint8Array is not transferable)
      let bin = '';
      for (let j = 0; j < slice.length; j++) bin += String.fromCharCode(slice[j]);
      await ipcRenderer.invoke('save-binary-file-chunk', filePath, btoa(bin));
    }

    await ipcRenderer.invoke('save-binary-file-end', filePath);
    return true;
  } catch (error) {
    console.error('Binary chunked save failed:', error);
    return false;
  }
};

contextBridge.exposeInMainWorld('electronAPI', {
  onLoadWorkspace: (callback) => {
    _loadWorkspaceCallback = callback;
    // Flush any events that arrived before React registered this callback
    if (_pendingLoadWorkspaceQueue.length > 0) {
      const queue = [..._pendingLoadWorkspaceQueue];
      _pendingLoadWorkspaceQueue = [];
      queueMicrotask(() => {
        for (const pending of queue) {
          callback(pending.filePath, pending.fileContent);
        }
      });
    }
    return () => { _loadWorkspaceCallback = null; };
  },
  setDirty: (isDirty) => ipcRenderer.send('set-dirty-state', isDirty),
  onCanClose: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('can-i-close', handler);
    return () => ipcRenderer.removeListener('can-i-close', handler);
  },
  confirmClose: () => ipcRenderer.send('confirm-close'),
  onSaveAndQuit: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('request-save-and-quit', handler);
    return () => ipcRenderer.removeListener('request-save-and-quit', handler);
  },
  savedAndReadyToQuit: () => ipcRenderer.send('saved-and-ready-to-quit'),
  saveFile: async (filePath, content) => {
    return await saveContentToFile(filePath, content);
  },
  saveAs: async (content) => {
    try {
      const filePath = await ipcRenderer.invoke('get-save-path');
      if (!filePath) return { success: false, filePath: null };

      const success = await saveContentToFile(filePath, content);
      return { success, filePath, error: success ? undefined : 'Save failed' };
    } catch (error) {
      console.error('Save As failed:', error);
      return { success: false, filePath: null, error: error.message };
    }
  },
  openFileDialog: async () => {
    return await ipcRenderer.invoke('open-file-dialog');
  },
  // Electron 32+ replacement for File.path (removed). Returns absolute path of a dropped File.
  getPathForFile: (file) => {
    try { return webUtils.getPathForFile(file); }
    catch { return null; }
  },
  // Electron 32+ replacement for File.path (removed). Returns absolute path of a dropped File.
  getPathForFile: (file) => {
    try { return webUtils.getPathForFile(file); }
    catch { return null; }
  },
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  readBinaryFile: (filePath) => ipcRenderer.invoke('read-binary-file', filePath),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  writeImage: (dataURL) => ipcRenderer.send('clipboard-write-image', dataURL),
  readImage: () => ipcRenderer.invoke('clipboard-read-image'),
  loadPresets: () => ipcRenderer.invoke('load-presets'),
  savePresets: (folders) => ipcRenderer.invoke('save-presets', folders),
  quitApp: () => ipcRenderer.send('quit-app'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  toggleAlwaysOnTop: () => ipcRenderer.send('toggle-always-on-top'),
  onAlwaysOnTopChanged: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('always-on-top-changed', handler);
    return () => ipcRenderer.removeListener('always-on-top-changed', handler);
  },
  onMaximizeChanged: (callback) => {
    ipcRenderer.on('maximize-changed', (_event, value) => callback(value));
  },
  restartApp: () => ipcRenderer.send('restart-app'),
createBlankWorkspace: () => ipcRenderer.send('create-blank-workspace'),
  startAuthServer: () => ipcRenderer.invoke('start-auth-server'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  generateContentVertex: (params) => ipcRenderer.invoke('generate-content-vertex', params),
  editImageVertex: (params) => ipcRenderer.invoke('edit-image-vertex', params),
  // ── 앱 내 Google ADC 인증 ──────────────────────────────────────────────
  googleAuthStart: (projectId) => ipcRenderer.invoke('google-auth-start', { projectId }),
  googleAuthCancel: () => ipcRenderer.invoke('google-auth-cancel'),
  googleAuthStatus: () => ipcRenderer.invoke('google-auth-status'),
  googleAuthRefresh: () => ipcRenderer.invoke('google-auth-refresh'),
  googleAuthLogout: () => ipcRenderer.invoke('google-auth-logout'),
  googleAuthSetProject: (projectId) => ipcRenderer.invoke('google-auth-set-project', { projectId }),
  googleAuthListProjects: (accessToken) => ipcRenderer.invoke('google-auth-list-projects', { accessToken }),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  saveFileToDirectory: (directoryPath, fileName, blob) => ipcRenderer.invoke('save-file-to-directory', { directoryPath, fileName, blob }),
  clearAppCache: () => ipcRenderer.invoke('clear-app-cache'),
  setWindowTitle: (title) => ipcRenderer.send('set-window-title', title),
  saveWorkspaceFile: async (filePath, uint8) => saveBinaryToFile(filePath, uint8),
  saveWorkspaceAs: async (uint8, defaultName) => {
    const filePath = await ipcRenderer.invoke('get-save-path', defaultName);
    if (!filePath) return { success: false, filePath: null };
    const success = await saveBinaryToFile(filePath, uint8);
    return { success, filePath: success ? filePath : null, error: success ? undefined : 'Save failed' };
  },
  readWorkspaceFile: (filePath) => ipcRenderer.invoke('read-workspace-file', filePath),
  renameWorkspaceFile: (oldPath, newName) => ipcRenderer.invoke('rename-workspace-file', oldPath, newName),
  saveAutosaveWorkspaceBinary: (uint8) => {
    // Encode to base64 for small autosaves; large ones are fine since autosave is async
    let bin = '';
    for (let i = 0; i < uint8.length; i++) bin += String.fromCharCode(uint8[i]);
    return ipcRenderer.invoke('save-autosave-workspace-binary', btoa(bin));
  },
  saveTempFile: (fileName, blob) => ipcRenderer.invoke('save-temp-file', { fileName, blob }),
  copyFile: (sourcePath, destPath) => ipcRenderer.invoke('copy-file', { sourcePath, destPath }),
  getTempStats: () => ipcRenderer.invoke('get-temp-stats'),
  cleanupTempFiles: () => ipcRenderer.invoke('cleanup-temp-files'),
  // [MEMORY V2] Session Recovery APIs
  getRecoverableSessions: () => ipcRenderer.invoke('get-recoverable-sessions'),
  recoverSession: (sessionId) => ipcRenderer.invoke('recover-session', sessionId),
  deleteSession: (sessionId) => ipcRenderer.invoke('delete-session', sessionId),
  // [AUTOSAVE] Save workspace to current session dir
  saveAutosaveWorkspace: (content) => ipcRenderer.invoke('save-autosave-workspace', content),
  // [GPU MONITOR] GPU Info and VRAM Monitoring APIs
  getGpuInfo: () => ipcRenderer.invoke('get-gpu-info'),
  getGpuMemoryUsage: () => ipcRenderer.invoke('get-gpu-memory-usage'),
  // [DRM] safeStorage — OS 레벨 암호화 (AES-256 via Keychain/DPAPI)
  safeStorageSet: (key, value) => ipcRenderer.invoke('safe-storage-set', { key, value }),
  safeStorageGet: (key) => ipcRenderer.invoke('safe-storage-get', { key }),
  safeStorageDelete: (key) => ipcRenderer.invoke('safe-storage-delete', { key }),
  // [THUMB HANDLER] 썸네일 핸들러 수동 재등록
  refreshThumbnailHandler: () => ipcRenderer.invoke('refresh-thumbnail-handler'),
  // [AUTO-UPDATE] electron-updater IPC
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  setUpdatePolicy: (policy, severity) => ipcRenderer.invoke('update:set-policy', { policy, severity }),
  applyUpdateNow: () => ipcRenderer.invoke('update:apply-now'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, status) => callback(status));
    return () => ipcRenderer.removeAllListeners('update-status');
  },
  // [GLASS] OS-level acrylic/vibrancy blur
  setGlassLevel: (level) => ipcRenderer.invoke('set-glass-level', level),
});