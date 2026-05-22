const { app, BrowserWindow, nativeTheme, ipcMain, dialog, clipboard, nativeImage, screen, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { VertexAI } = require('@google-cloud/vertexai');
const { GoogleAuth } = require('google-auth-library');
const { GoogleGenAI } = require('@google/genai');
const { exec, spawn } = require('child_process');
const googleAuth = require('./src/services/auth/googleAuthMain');

// [PERF] GPU Optimization Flags - Must be set before app is ready
// These improve WebGL rendering and reduce conflicts with CSS backdrop-filter
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-software-rasterizer');

// [DPI] Windows 고DPI 모니터에서 흐려 보임 방지 — 시스템 스케일(125%/150%) 자동 인식
// Electron은 기본적으로 DPI 인식. v35에서 커스텀 스케일러 제거 — OS DPI 직접 위임.
if (process.platform === 'win32') {
    app.commandLine.appendSwitch('high-dpi-support', '1');
}

// [STABILITY] Memory Management Flags for large-scale image handling
// Increase V8 heap limit to 8GB for handling 1000+ images
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');
// Enable WebGL features for better texture management
app.commandLine.appendSwitch('enable-webgl2-compute-context');
// [PLATFORM] Windows-only: GPU memory buffer count (not applicable on macOS/Linux)
if (process.platform === 'win32') {
    app.commandLine.appendSwitch('gpu-memory-buffer-count', '256');
}
// [PLATFORM] macOS: Use Metal backend for better WebGL stability with PixiJS
if (process.platform === 'darwin') {
    app.commandLine.appendSwitch('use-angle', 'metal');
}

// Log file path - will be created after app is ready
let LOG_FILE;

// Helper function to write logs to file
function writeLog(message) {
    try {
        if (!LOG_FILE) {
            LOG_FILE = path.join(app.getPath('userData'), 'vertex-ai-debug.log');
        }
        const timestamp = new Date().toISOString();
        // Use simple string concatenation to avoid potential template literal issues
        const logMessage = '[' + timestamp + '] ' + message + '\n';
        fs.appendFileSync(LOG_FILE, logMessage);
        console.log(message);
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
}

const windows = new Set();

// Track workspace file path for each window independently
// Using WeakMap ensures automatic cleanup when windows are closed
const windowWorkspacePaths = new WeakMap();

// Window state persistence - saved to userData, separate from workspace
const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
    try {
        if (fs.existsSync(WINDOW_STATE_FILE)) {
            const data = fs.readFileSync(WINDOW_STATE_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.warn('Failed to load window state:', error);
    }
    return null;
}

function saveWindowState(browserWindow) {
    try {
        const isMaximized = browserWindow.isMaximized();
        // Get bounds before checking maximized state
        // If maximized, we save the "restored" bounds (the size before maximizing)
        const bounds = isMaximized ? browserWindow.getNormalBounds() : browserWindow.getBounds();

        const state = {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            isMaximized: isMaximized,
        };

        fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
        console.log('[WindowState] Saved:', state);
    } catch (error) {
        console.error('Failed to save window state:', error);
    }
}

// Handle file to open on startup from command line arguments (Windows/Linux) or open-file event (macOS)
const getWorkspaceFilePath = (argv) => {
    return argv.find(arg =>
        arg.endsWith('.nyang') ||
        arg.endsWith('.bananyang') ||
        arg.endsWith('.rfy') ||
        arg.endsWith('.reflity')
    ) || null;
};

// Extract ALL workspace file paths from argv (for multi-file open)
const getWorkspaceFilePaths = (argv) => {
    return argv.filter(arg =>
        arg.endsWith('.nyang') ||
        arg.endsWith('.bananyang') ||
        arg.endsWith('.rfy') ||
        arg.endsWith('.reflity')
    );
};

let openFilePath = getWorkspaceFilePath(process.argv);

// Queue of file paths waiting to be sent to the renderer.
// When multiple files are opened from Explorer simultaneously, each launches
// a separate process that triggers 'second-instance'. The main window may
// still be loading (did-finish-load not yet fired), so we queue the paths
// and flush them once the renderer is ready.
let pendingFilePaths = [];
let mainWindowReady = false;

function sendWorkspaceFileToWindow(targetWindow, filePath) {
    if (!targetWindow || targetWindow.isDestroyed()) return;
    if (targetWindow.webContents.isLoading()) {
        // Window is still loading — queue and flush after did-finish-load
        pendingFilePaths.push(filePath);
    } else {
        targetWindow.webContents.send('load-workspace', filePath, undefined);
    }
}

function flushPendingFiles(targetWindow) {
    if (!targetWindow || targetWindow.isDestroyed()) return;
    const paths = [...pendingFilePaths];
    pendingFilePaths = [];
    for (const fp of paths) {
        targetWindow.webContents.send('load-workspace', fp, undefined);
    }
}

// Ensure only one instance of the app is running.
// When a second instance is launched (e.g. double-clicking a save file),
// the file is loaded as a new workspace tab in the existing window
// instead of creating a separate window.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine) => {
        // Extract all workspace file paths from the command line
        const filePaths = getWorkspaceFilePaths(commandLine);

        // Focus the last active window (or create one if none exist)
        const targetWindow = Array.from(windows).pop();
        if (!targetWindow) {
            // No window exists — create one and load the first file
            if (filePaths.length > 0) {
                createWindow(filePaths[0]);
                // Remaining files will be queued and sent after the window is ready
                const newWin = Array.from(windows).pop();
                if (newWin) {
                    for (let i = 1; i < filePaths.length; i++) {
                        pendingFilePaths.push(filePaths[i]);
                    }
                    // did-finish-load handler in createWindow will call flushPendingFiles
                }
            } else {
                createWindow(null);
            }
            return;
        }

        // Restore and focus the existing window
        if (targetWindow.isMinimized()) targetWindow.restore();
        targetWindow.focus();

        // Send each file to the existing window as a new workspace tab
        if (filePaths.length > 0) {
            for (const fp of filePaths) {
                sendWorkspaceFileToWindow(targetWindow, fp);
            }
        }
    });
}

function loadWorkspaceFromFile(browserWindow, filePath) {
    if (!browserWindow) return;
    // Store the workspace file path for this window
    if (filePath) {
        windowWorkspacePaths.set(browserWindow, filePath);
    }
    // Just send the file path. The renderer will show a loading screen and request the content.
    browserWindow.webContents.send('load-workspace', filePath, undefined);
}

ipcMain.on('minimize-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.minimize();
    }
});

ipcMain.on('close-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.close();
    }
});

ipcMain.on('toggle-always-on-top', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        const isAlwaysOnTop = window.isAlwaysOnTop();
        window.setAlwaysOnTop(!isAlwaysOnTop);
        event.reply('always-on-top-changed', !isAlwaysOnTop);
    }
});


ipcMain.on('quit-app', (event) => {
    // Close only the current window instead of quitting the entire app
    // This allows multiple workspace windows to operate independently
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.close();
    }
});

ipcMain.on('restart-app', () => {
    app.relaunch();
    app.quit();
});

ipcMain.handle('clear-app-cache', async (event) => {
    try {
        const window = BrowserWindow.fromWebContents(event.sender);
        const ses = window ? window.webContents.session : session.defaultSession;
        await ses.clearCache();
        await ses.clearStorageData();
        app.relaunch();
        app.quit();
        return true;
    } catch (error) {
        console.error('Failed to clear cache:', error);
        return false;
    }
});


ipcMain.on('create-blank-workspace', (event) => {
    // Simply create a new window without loading any workspace content
    createWindow(null);
});


ipcMain.on('set-dirty-state', (event, dirty) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.isDirty = dirty;
    }
});

ipcMain.on('set-window-title', (event, title) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.setTitle(title);
    }
});

// Binary chunked save for ZIP-based workspace files (.nyang container format)
ipcMain.handle('save-binary-file-start', async (event, filePath) => {
    try {
        const tmpPath = filePath + '.tmp';
        fs.writeFileSync(tmpPath, Buffer.alloc(0));
        return true;
    } catch (error) {
        console.error('Failed to start binary save file:', error);
        throw error;
    }
});

ipcMain.handle('save-binary-file-chunk', async (event, filePath, chunkBase64) => {
    try {
        const tmpPath = filePath + '.tmp';
        fs.appendFileSync(tmpPath, Buffer.from(chunkBase64, 'base64'));
        return true;
    } catch (error) {
        console.error('Failed to write binary chunk:', error);
        try { fs.unlinkSync(filePath + '.tmp'); } catch {}
        throw error;
    }
});

ipcMain.handle('save-binary-file-end', async (event, filePath) => {
    const tmpPath = filePath + '.tmp';
    const bakPath = filePath + '.bak';
    try {
        const tmpContent = fs.readFileSync(tmpPath);

        // ZIP magic byte check (replaces JSON.parse sanity check)
        if (tmpContent.length < 4 ||
            tmpContent[0] !== 0x50 || tmpContent[1] !== 0x4B ||
            tmpContent[2] !== 0x03 || tmpContent[3] !== 0x04) {
            try { fs.unlinkSync(tmpPath); } catch {}
            throw new Error('Save aborted: not a valid ZIP container');
        }

        const expectedHash = crypto.createHash('sha256').update(tmpContent).digest('hex');

        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(bakPath); } catch {}
            fs.renameSync(filePath, bakPath);
        }
        fs.renameSync(tmpPath, filePath);

        const savedContent = fs.readFileSync(filePath);
        const actualHash = crypto.createHash('sha256').update(savedContent).digest('hex');
        if (actualHash !== expectedHash) {
            if (fs.existsSync(bakPath)) {
                try { fs.renameSync(bakPath, filePath); } catch {}
            }
            throw new Error('Save integrity check failed: hash mismatch after write');
        }

        try { fs.unlinkSync(bakPath); } catch {}
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window && filePath) {
            windowWorkspacePaths.set(window, filePath);
        }
        return true;
    } catch (error) {
        console.error('Failed to finalize binary save file:', error);
        try { fs.unlinkSync(tmpPath); } catch {}
        throw error;
    }
});

ipcMain.handle('save-file', async (event, filePath, content) => {
    try {
        const window = BrowserWindow.fromWebContents(event.sender);
        fs.writeFileSync(filePath, content, 'utf-8');
        // Update the workspace path for this window after successful save
        if (window && filePath) {
            windowWorkspacePaths.set(window, filePath);
        }
        return true;
    } catch (error) {
        console.error('Failed to save file:', error);
        return false;
    }
});

ipcMain.handle('save-file-start', async (event, filePath) => {
    try {
        // Write to a temp file first — never touch the original until the save is complete
        const tmpPath = filePath + '.tmp';
        fs.writeFileSync(tmpPath, '', 'utf-8');
        return true;
    } catch (error) {
        console.error('Failed to start save file:', error);
        throw error;
    }
});

ipcMain.handle('save-file-chunk', async (event, filePath, chunk) => {
    try {
        const tmpPath = filePath + '.tmp';
        fs.appendFileSync(tmpPath, chunk, 'utf-8');
        return true;
    } catch (error) {
        console.error('Failed to write chunk:', error);
        // Clean up the partial temp file so the next save starts fresh
        try { fs.unlinkSync(filePath + '.tmp'); } catch {}
        throw error;
    }
});

ipcMain.handle('save-file-end', async (event, filePath) => {
    const tmpPath = filePath + '.tmp';
    const bakPath = filePath + '.bak';
    try {
        // 1. Compute SHA-256 of the temp file before touching the original
        const tmpContent = fs.readFileSync(tmpPath);
        const expectedHash = crypto.createHash('sha256').update(tmpContent).digest('hex');

        // 2. Quick structural sanity check — parse JSON before committing
        try {
            JSON.parse(tmpContent.toString('utf-8'));
        } catch (parseErr) {
            try { fs.unlinkSync(tmpPath); } catch {}
            throw new Error(`Save aborted: temp file is not valid JSON (${parseErr.message})`);
        }

        // 3. Rotate current file → .bak (one backup generation)
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(bakPath); } catch {}
            fs.renameSync(filePath, bakPath);
        }

        // 4. Atomic rename: .tmp → final
        fs.renameSync(tmpPath, filePath);

        // 5. Post-verify: re-read and confirm hash matches
        const savedContent = fs.readFileSync(filePath);
        const actualHash = crypto.createHash('sha256').update(savedContent).digest('hex');
        if (actualHash !== expectedHash) {
            // Hash mismatch — restore backup and abort
            if (fs.existsSync(bakPath)) {
                try { fs.renameSync(bakPath, filePath); } catch {}
            }
            throw new Error('Save integrity check failed: hash mismatch after write');
        }

        try { fs.unlinkSync(bakPath); } catch {}
        return true;
    } catch (error) {
        console.error('Failed to finalize save file:', error);
        try { fs.unlinkSync(tmpPath); } catch {}
        throw error;
    }
});

ipcMain.handle('rename-workspace-file', async (event, oldPath, newName) => {
    try {
        if (typeof oldPath !== 'string' || !oldPath) throw new Error('oldPath required');
        if (typeof newName !== 'string') throw new Error('newName required');

        // 잘못된 문자 제거 + whitespace 정규화
        const sanitized = newName
            .replace(/[\\/:*?"<>|]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!sanitized) throw new Error('Sanitized name is empty');

        const ext = path.extname(oldPath); // '.nyang' 등
        const dir = path.dirname(oldPath);
        const baseWithoutExt = sanitized.endsWith(ext)
            ? sanitized.slice(0, -ext.length)
            : sanitized.replace(/\.[^.]+$/, '');
        const finalBase = baseWithoutExt || sanitized;
        const newPath = path.join(dir, finalBase + ext);

        if (newPath === oldPath) return oldPath;
        if (!fs.existsSync(oldPath)) throw new Error('Source file does not exist');
        if (fs.existsSync(newPath)) throw new Error('A file with that name already exists');

        fs.renameSync(oldPath, newPath);

        // .bak sibling도 함께 이동 (best-effort)
        const oldBak = oldPath + '.bak';
        const newBak = newPath + '.bak';
        if (fs.existsSync(oldBak)) {
            try { fs.renameSync(oldBak, newBak); } catch (e) { console.warn('Could not rename .bak:', e); }
        }

        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) windowWorkspacePaths.set(window, newPath);

        return newPath;
    } catch (error) {
        console.error('Failed to rename workspace file:', error);
        throw error;
    }
});

ipcMain.handle('get-save-path', async (event, defaultName) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;

    let suggested = `bananyang-workspace-${new Date().toISOString().slice(0, 10)}.nyang`;
    if (typeof defaultName === 'string' && defaultName.trim()) {
        const sanitized = defaultName
            .replace(/[\\/:*?"<>|]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (sanitized) {
            suggested = sanitized.toLowerCase().endsWith('.nyang')
                ? sanitized
                : `${sanitized}.nyang`;
        }
    }

    const { canceled, filePath } = await dialog.showSaveDialog(window, {
        title: 'Save Workspace As',
        defaultPath: suggested,
        filters: [
            { name: 'BanaNyang Workspace', extensions: ['nyang'] }
        ]
    });

    if (canceled || !filePath) {
        return null;
    }
    return filePath;
});

// Deprecated: kept for backward compatibility if needed, but saveAs in preload will use get-save-path
ipcMain.handle('save-as-dialog', async (event, content) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return { success: false, filePath: null, error: 'Window not available' };

    const { canceled, filePath } = await dialog.showSaveDialog(window, {
        title: 'Save Workspace As',
        defaultPath: `bananyang-workspace-${new Date().toISOString().slice(0, 10)}.nyang`,
        filters: [
            { name: 'BanaNyang Workspace', extensions: ['nyang'] }
        ]
    });

    if (canceled || !filePath) {
        return { success: false, filePath: null };
    }

    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true, filePath: filePath };
    } catch (error) {
        console.error('Failed to save file via Save As:', error);
        return { success: false, filePath: filePath, error: error.message };
    }
});

ipcMain.on('saved-and-ready-to-quit', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.isDirty = false;
        window.close();
    }
});

ipcMain.on('confirm-close', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.destroy();
    }
});

ipcMain.handle('open-file-dialog', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
        title: 'Open Workspace',
        properties: ['openFile'],
        filters: [{ name: 'BanaNyang Workspace', extensions: ['nyang', 'rfy', 'reflity', 'bananyang'] }]
    });

    if (canceled || filePaths.length === 0) {
        return null;
    }

    return filePaths[0]; // Return only the path
});

// Select directory dialog
ipcMain.handle('select-directory', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
        title: 'Select Save Directory',
        properties: ['openDirectory']
    });

    if (canceled || filePaths.length === 0) {
        return null;
    }

    return filePaths[0]; // Return the directory path
});

// [Security] 워크스페이스 파일 확장자 whitelist
const ALLOWED_WORKSPACE_EXTENSIONS = new Set(['.nyang', '.rfy', '.bananyang']);
// [Security] 이미지/바이너리 파일 확장자 whitelist
const ALLOWED_BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp',
    '.ktx2', '.exr', '.psd', '.psb', '.tiff', '.tif',
]);

ipcMain.handle('read-file', (event, filePath) => {
    if (typeof filePath !== 'string') return Promise.resolve(null);
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_WORKSPACE_EXTENSIONS.has(ext)) {
        console.warn('[Security] Blocked read-file for disallowed extension:', ext);
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        fs.readFile(filePath, 'utf-8', (err, content) => {
            if (err) {
                console.error('Failed to read file:', err);
                resolve(null);
            } else {
                resolve(content);
            }
        });
    });
});

// [NEW] Read workspace file as base64 — supports both ZIP and legacy JSON .nyang files
ipcMain.handle('read-workspace-file', (event, filePath) => {
    if (typeof filePath !== 'string') return Promise.resolve(null);
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_WORKSPACE_EXTENSIONS.has(ext)) {
        console.warn('[Security] Blocked read-workspace-file for disallowed extension:', ext);
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        fs.readFile(filePath, (err, buffer) => {
            if (err) {
                console.error('Failed to read workspace file:', err);
                resolve(null);
            } else {
                resolve({ base64: buffer.toString('base64'), size: buffer.length });
            }
        });
    });
});

// [NEW] Check if file exists on disk (lightweight existence check for memory offloading)
ipcMain.handle('file-exists', (event, filePath) => {
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
});

// [NEW] Read binary file as base64 - for images and other binary data
ipcMain.handle('read-binary-file', (event, filePath) => {
    if (typeof filePath !== 'string') return Promise.resolve(null);
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_BINARY_EXTENSIONS.has(ext)) {
        console.warn('[Security] Blocked read-binary-file for disallowed extension:', ext);
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        fs.readFile(filePath, (err, buffer) => {
            if (err) {
                console.error('Failed to read binary file:', err);
                resolve(null);
            } else {
                // Convert buffer to base64
                resolve(buffer.toString('base64'));
            }
        });
    });
});

ipcMain.on('clipboard-write-image', (event, dataURL) => {
    if (dataURL) {
        const image = nativeImage.createFromDataURL(dataURL);
        clipboard.writeImage(image);
    }
});

ipcMain.handle('clipboard-read-image', async () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) {
        return null;
    }
    return image.toDataURL();
});

// Open folder in file explorer
ipcMain.handle('open-folder', async (event, folderPath) => {
    try {
        await shell.openPath(folderPath);
        return { success: true };
    } catch (error) {
        console.error('Failed to open folder:', error);
        return { success: false, error: error.message };
    }
});

// Save file to directory (for Electron-based downloads)
ipcMain.handle('save-file-to-directory', async (event, { directoryPath, fileName, blob }) => {
    try {
        // [Security] fileName에서 경로 탈출 방지 (../../../ 등)
        const safeFileName = path.basename(fileName);
        const filePath = path.join(directoryPath, safeFileName);
        // [Security] 최종 경로가 directoryPath 내에 있는지 검증
        if (!path.resolve(filePath).startsWith(path.resolve(directoryPath))) {
            console.warn('[Security] Blocked save-file-to-directory path traversal:', filePath);
            return { success: false, error: 'Invalid file path' };
        }
        // Convert blob (base64 or buffer) to actual file
        let buffer;
        if (typeof blob === 'string') {
            // Assume base64 data URL
            const base64Data = blob.split(',')[1] || blob;
            buffer = Buffer.from(base64Data, 'base64');
        } else if (blob instanceof Uint8Array || Buffer.isBuffer(blob)) {
            buffer = Buffer.from(blob);
        } else {
            throw new Error('Unsupported blob format');
        }

        fs.writeFileSync(filePath, buffer);
        return { success: true, filePath };
    } catch (error) {
        console.error('Failed to save file to directory:', error);
        return { success: false, error: error.message };
    }
});

// Copy file (for efficient auto-save from temp)
ipcMain.handle('copy-file', async (event, { sourcePath, destPath }) => {
    try {
        // [Security] 이미지/워크스페이스 확장자만 허용
        const ALLOWED_COPY_EXTENSIONS = new Set([
            ...ALLOWED_BINARY_EXTENSIONS, ...ALLOWED_WORKSPACE_EXTENSIONS,
        ]);
        const srcExt = path.extname(sourcePath).toLowerCase();
        const dstExt = path.extname(destPath).toLowerCase();
        if (!ALLOWED_COPY_EXTENSIONS.has(srcExt) || !ALLOWED_COPY_EXTENSIONS.has(dstExt)) {
            console.warn('[Security] Blocked copy-file for disallowed extension:', srcExt, dstExt);
            return { success: false, error: 'Invalid file extension' };
        }
        fs.copyFileSync(sourcePath, destPath);
        return { success: true };
    } catch (error) {
        console.error('Failed to copy file:', error);
        return { success: false, error: error.message };
    }
});

const appDataPath = app.getPath('userData');
const presetsFilePath = path.join(appDataPath, 'user-presets.json');

ipcMain.handle('load-presets', async () => {
    try {
        if (fs.existsSync(presetsFilePath)) {
            const data = fs.readFileSync(presetsFilePath, 'utf-8');
            return JSON.parse(data);
        }
        return null; // No file exists yet, will use defaults in renderer
    } catch (error) {
        console.error('Failed to load presets:', error);
        return null;
    }
});

ipcMain.handle('save-presets', async (event, folders) => {
    try {
        // Ensure the directory exists
        if (!fs.existsSync(appDataPath)) {
            fs.mkdirSync(appDataPath, { recursive: true });
        }
        const data = JSON.stringify(folders, null, 2); // Pretty print JSON
        fs.writeFileSync(presetsFilePath, data, 'utf-8');
        return true;
    } catch (error) {
        console.error('Failed to save presets:', error);
        return false;
    }
});

// --- Google Auth Loopback Server ---
const http = require('http');

let authServerInstance = null;

ipcMain.handle('start-auth-server', async () => {
    return new Promise((resolve) => {
        // Close existing server if any
        if (authServerInstance) {
            try {
                authServerInstance.close();
                authServerInstance = null;
                console.log('Closed existing auth server before starting new one.');
            } catch (e) {
                console.error('Error closing existing server:', e);
            }
        }

        const startServer = (retry = false) => {
            const server = http.createServer((req, res) => {
                const url = new URL(req.url, 'http://localhost:3000');
                const code = url.searchParams.get('code');
                const error = url.searchParams.get('error');

                if (code) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('<h1>Login Successful!</h1><p>You can close this window and return to BanaNyang.</p><script>window.close();</script>');
                    server.close();
                    authServerInstance = null;
                    resolve({ success: true, code });
                } else if (error) {
                    res.writeHead(400);
                    res.end('Authorization failed.');
                    server.close();
                    authServerInstance = null;
                    resolve({ success: false, error: `OAuth Error: ${error} ` });
                } else {
                    res.writeHead(400);
                    res.end('Authorization code not found.');
                    server.close();
                    authServerInstance = null;
                    resolve({ success: false, error: 'Authorization code not found in callback.' });
                }
            });

            authServerInstance = server;

            server.on('error', (err) => {
                authServerInstance = null;
                if (err.code === 'EADDRINUSE') {
                    if (!retry) {
                        console.log('Port 3000 in use, attempting to close existing server and retry...');
                        resolve({ success: false, error: 'Port 3000 is already in use. Please close any other instances of BanaNyang or applications using port 3000.' });
                    } else {
                        resolve({ success: false, error: `Server Error: ${err.message} ` });
                    }
                } else {
                    console.error('Auth server error:', err);
                    resolve({ success: false, error: `Server Error: ${err.message} ` });
                }
            });

            try {
                server.listen(3000, () => {
                    console.log('Auth server listening on port 3000');
                    // Timeout after 5 minutes if no code received
                    setTimeout(() => {
                        if (server.listening) {
                            server.close();
                            if (authServerInstance === server) authServerInstance = null;
                            resolve({ success: false, error: 'Timeout: No response received within 5 minutes.' });
                        }
                    }, 300000);
                });
            } catch (e) {
                authServerInstance = null;
                resolve({ success: false, error: `Failed to start server: ${e.message} ` });
            }
        };

        startServer();
    });
});

ipcMain.on('open-external', (event, url) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
        shell.openExternal(url);
    } else {
        console.warn('[Security] Blocked non-http(s) open-external request:', url);
    }
});

// --- Vertex AI (ADC) Integration ---

// Project ID 우선순위: 1) 명시적 파라미터  2) ADC 파일  3) 오류
async function getEffectiveProjectId(explicitProjectId) {
    if (explicitProjectId) return explicitProjectId;
    // ADC 파일에서 project ID 확인
    const adcStatus = googleAuth.checkAdcStatus();
    console.log('[Vertex AI] getEffectiveProjectId — explicitProjectId:', explicitProjectId, '| ADC status:', JSON.stringify(adcStatus));
    if (adcStatus.hasAdc && adcStatus.projectId) return adcStatus.projectId;
    if (!adcStatus.hasAdc) {
        throw new Error(
            'Google 계정이 연결되어 있지 않습니다. ' +
            '설정 → API 탭에서 "Google로 연결하기"를 눌러 주세요.'
        );
    }
    throw new Error(
        'Cloud Project ID가 선택되지 않았습니다. ' +
        '설정 → API 탭에서 프로젝트를 선택해 주세요.'
    );
}

// ADC 파일 기반 액세스 토큰 획득 (google-auth-library)
async function getGcloudAccessToken() {
    const token = await googleAuth.refreshAccessToken();
    if (!token) throw new Error('인증이 필요합니다. 설정 → API 탭에서 Google 계정을 연결해 주세요.');
    return token;
}

// ── 앱 내 Google ADC 인증 IPC 핸들러 ────────────────────────────────────

// Google OAuth2 브라우저 인증 시작 → ADC 파일 생성
ipcMain.handle('google-auth-start', async (event, { projectId }) => {
    return googleAuth.startOAuth2Flow({ projectId });
});

// ADC 파일 존재 여부 및 메타데이터 확인
ipcMain.handle('google-auth-status', async () => {
    return googleAuth.checkAdcStatus();
});

// Access Token 갱신 (ADC 파일 사용)
ipcMain.handle('google-auth-refresh', async () => {
    try {
        const token = await googleAuth.refreshAccessToken();
        return { success: true, accessToken: token };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ADC 파일 삭제 (연결 해제)
ipcMain.handle('google-auth-logout', async () => {
    googleAuth.deleteAdcFile();
    return { success: true };
});

// ADC 파일의 Project ID 업데이트
ipcMain.handle('google-auth-set-project', async (event, { projectId }) => {
    try {
        googleAuth.updateAdcProject(projectId);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 사용자 프로젝트 목록 조회 (Cloud Resource Manager API)
ipcMain.handle('google-auth-list-projects', async (event, { accessToken } = {}) => {
    try {
        const projects = await googleAuth.listProjects(accessToken || null);
        return { success: true, projects };
    } catch (error) {
        return { success: false, error: error.message, projects: [] };
    }
});

// OAuth 플로우 취소
ipcMain.handle('google-auth-cancel', async () => {
    googleAuth.cancelOAuth2Flow();
    return { success: true };
});

ipcMain.handle('generate-content-vertex', async (event, { model, prompt, config, safetySettings, projectId, location = 'us-central1' }) => {
    // Declare variables at function scope so they're accessible in catch block
    let actualModel = model;
    let targetLocation = location || 'us-central1';

    try {
        const targetProject = await getEffectiveProjectId(projectId);
        const vertex_ai = new VertexAI({ project: targetProject, location: location });

        // Map user-friendly model names to actual Vertex AI model IDs
        if (actualModel.startsWith('models/')) {
            actualModel = actualModel.replace('models/', '');
        }

        // Custom mappings for user-defined model names
        // (Removed mapping for gemini-2.5-flash/lite to allow pass-through as per user request)

        // Construct the request contents first (needed for both SDK and REST API)
        let contents;
        if (typeof prompt === 'string') {
            contents = [{ role: 'user', parts: [{ text: prompt }] }];
        } else if (Array.isArray(prompt)) {
            if (prompt.length > 0 && prompt[0].role) {
                contents = prompt;
            } else {
                contents = [{ role: 'user', parts: prompt }];
            }
        } else if (prompt && typeof prompt === 'object' && prompt.parts && Array.isArray(prompt.parts)) {
            contents = [{ role: 'user', parts: prompt.parts }];
        } else {
            contents = [{ role: 'user', parts: [{ text: JSON.stringify(prompt) }] }];
        }

        // CRITICAL FIX: gemini-3-pro-image-preview and gemini-2.5 models use REST API with publishers/google/models path
        // This matches the cURL sample from Vertex AI Studio
        // Added support for Gemini 3.0, 3.1, and 2.5 models as they require global endpoint or specific handling
        if (actualModel === 'gemini-3-pro-image-preview' ||
            actualModel === 'gemini-3.1-flash-image-preview' ||
            actualModel === 'gemini-2.5-flash' ||
            actualModel === 'gemini-2.5-flash-lite' ||
            actualModel === 'gemini-2.5-flash-latest' ||
            actualModel === 'gemini-3-pro-preview') {

            writeLog(`Using REST API for ${actualModel}`);
            targetLocation = 'us-central1'; // Default to us-central1

            // Force global location for Preview models (Gemini 3.x models require global endpoint)
            if (actualModel === 'gemini-3-pro-image-preview' ||
                actualModel === 'gemini-3.1-flash-image-preview' ||
                actualModel === 'gemini-3-pro-preview' ||
                actualModel === 'gemini-2.5-flash-latest') {
                targetLocation = 'global';
            }

            try {
                const accessToken = await getGcloudAccessToken();
                const https = require('https');
                const { URL } = require('url');

                // Correct Vertex AI endpoint format
                // MUST use aiplatform.googleapis.com (no region prefix) and include project/location path
                const endpoint = `https://${targetLocation}-aiplatform.googleapis.com/v1/projects/${targetProject}/locations/${targetLocation}/publishers/google/models/${actualModel}:generateContent`;

                // For global, the hostname is different
                let finalEndpoint = endpoint;
                if (targetLocation === 'global') {
                    finalEndpoint = `https://aiplatform.googleapis.com/v1/projects/${targetProject}/locations/global/publishers/google/models/${actualModel}:generateContent`;
                }
                writeLog(`REST API endpoint: ${finalEndpoint}`);

                // Clean config by extracting tools and systemInstruction
                const cleanedConfig = config ? { ...config } : {};
                const toolsToSend = cleanedConfig.tools;
                const systemInstructionToSend = cleanedConfig.systemInstruction;
                delete cleanedConfig.tools;
                delete cleanedConfig.systemInstruction;

                // Validate contents - ensure each has non-empty parts
                const validContents = contents.filter(item => {
                    if (!item.parts || !Array.isArray(item.parts) || item.parts.length === 0) {
                        writeLog(`⚠️ Skipping content item with empty/missing parts: ${JSON.stringify(item)}`);
                        return false;
                    }
                    // Filter out empty text parts
                    item.parts = item.parts.filter(p => {
                        if (p.text !== undefined && p.text === '') return false;
                        return true;
                    });
                    return item.parts.length > 0;
                });

                if (validContents.length === 0) {
                    throw new Error('No valid contents to send - all parts are empty');
                }

                const requestBody = JSON.stringify({
                    contents: validContents,
                    generationConfig: cleanedConfig,
                    systemInstruction: systemInstructionToSend,
                    tools: toolsToSend,
                    safetySettings: safetySettings,
                });

                writeLog(`📤 REST API Request Body (first 2000 chars): ${requestBody.substring(0, 2000)}`);

                const url = new URL(finalEndpoint);
                const options = {
                    hostname: url.hostname,
                    port: 443,
                    path: url.pathname,
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(requestBody)
                    }
                };

                return await new Promise((resolve, reject) => {
                    const req = https.request(options, (res) => {
                        let data = '';
                        res.on('data', (chunk) => { data += chunk; });
                        res.on('end', () => {
                            if (res.statusCode >= 200 && res.statusCode < 300) {
                                try {
                                    const response = JSON.parse(data);
                                    writeLog('✅ REST API request successful');
                                    writeLog(`Response: ${JSON.stringify(response).substring(0, 500)}...`);
                                    resolve({ success: true, response: response });
                                } catch (e) {
                                    writeLog(`Failed to parse response: ${e.message}`);
                                    reject(new Error(`Failed to parse response: ${e.message}`));
                                }
                            } else {
                                writeLog(`❌ REST API request failed: ${res.statusCode}`);
                                writeLog(`Response: ${data}`);
                                reject(new Error(`REST API error ${res.statusCode}: ${data}`));
                            }
                        });
                    });

                    req.on('error', (error) => {
                        writeLog(`Request error: ${error.message}`);
                        reject(error);
                    });

                    req.write(requestBody);
                    req.end();
                });
            } catch (restError) {
                writeLog(`REST API failed: ${restError.message}`);
                writeLog(`Error stack: ${restError.stack}`);

                // For global-only models, do NOT fallback to SDK (it won't work with us-central1)
                const globalOnlyModels = ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-preview'];
                if (globalOnlyModels.includes(actualModel)) {
                    writeLog(`Model ${actualModel} requires global location. No SDK fallback available.`);
                    throw restError; // Re-throw to be caught by outer handler
                }

                // Fallback: If global failed, try reverting to us-central1 for the SDK attempt
                // This covers cases where we incorrectly guessed the model was global
                if (targetLocation === 'global') {
                    writeLog('Global REST API failed, reverting to us-central1 for SDK fallback.');
                    targetLocation = 'us-central1';
                }
            }
        }

        // Recreate VertexAI instance with correct location (or fallback location)
        const vertex_ai_final = new VertexAI({ project: targetProject, location: targetLocation });

        // Extract tools and systemInstruction from config to ensure they are not passed in generationConfig
        const { tools, systemInstruction, ...cleanConfig } = config || {};

        // Use non-preview API for gemini-3-pro-image-preview, preview API for others
        const useNonPreviewAPI = actualModel === 'gemini-3-pro-image-preview';
        const generativeModel = useNonPreviewAPI
            ? vertex_ai_final.getGenerativeModel({
                model: actualModel,
                generationConfig: cleanConfig,
                safetySettings: safetySettings,
            })
            : vertex_ai_final.preview.getGenerativeModel({
                model: actualModel,
                generationConfig: cleanConfig,
                safetySettings: safetySettings,
            });

        // Construct the request. The prompt from frontend might be a string or array of parts.
        // The Vertex AI Node.js SDK expects 'contents' array.
        // (Already constructed above before REST API call)

        writeLog('=== Vertex AI Request Details ===');
        writeLog(`Model: ${actualModel} `);
        writeLog(`Location: ${targetLocation} `);
        writeLog(`Contents: ${JSON.stringify(contents, null, 2)} `);
        writeLog(`Config: ${JSON.stringify(cleanConfig, null, 2)} `);
        writeLog(`Tools: ${JSON.stringify(tools, null, 2)} `);
        writeLog('================================');

        const result = await generativeModel.generateContent({
            contents: contents,
            systemInstruction: systemInstruction,
            tools: tools,
        });

        const response = await result.response;

        // Normalize response to match what the frontend expects from the Google Gen AI SDK
        // The structure is very similar but might have slight differences.
        // We return the full response object.
        writeLog('✅ Vertex AI request successful');
        return { success: true, response: response };

    } catch (error) {
        writeLog('=== Vertex AI Generation Error ===');
        writeLog(`Error message: ${error.message} `);
        writeLog(`Error details: ${JSON.stringify(error, null, 2)} `);
        writeLog(`Error stack: ${error.stack} `);
        writeLog(`Model: ${actualModel} `);
        writeLog(`Location: ${targetLocation} `);
        writeLog('==================================');

        // Provide more helpful error messages
        let errorMessage = error.message;

        // Check for 404 errors (model not found)
        if (error.message && (error.message.includes('404') || error.message.includes('not found') || error.message.includes('NOT_FOUND'))) {
            if (actualModel === 'gemini-3-pro-image-preview') {
                errorMessage = `Model "gemini-3-pro-image-preview" is not available in Vertex AI.This model may be in preview and not yet released for Vertex AI.Please check: \n1.If the model is enabled in your Google Cloud project\n2.If you're using the correct region (currently: ${targetLocation})\n3. Consider using "imagen-3.0-generate-001" as an alternative`;
            } else {
                errorMessage = `Model "${actualModel}" was not found in Vertex AI. Please verify:\n1. The model name is correct\n2. The model is available in your region (${targetLocation})\n3. Your project has access to this model`;
            }
        }

        return { success: false, error: errorMessage, details: error };
    }
});

ipcMain.handle('edit-image-vertex', async (event, { originalBase64, maskBase64, mimeType, prompt, mode }) => {
    try {
        const targetProject = await getEffectiveProjectId(null);

        const { RawReferenceImage, MaskReferenceImage, MaskReferenceMode, EditMode } = require('@google/genai');

        const client = new GoogleGenAI({
            vertexai: true,
            project: targetProject,
            location: 'us-central1',
        });

        const rawRef = new RawReferenceImage();
        rawRef.referenceImage = { imageBytes: originalBase64, mimeType };
        rawRef.referenceId = 0;

        const maskRef = new MaskReferenceImage();
        maskRef.referenceImage = { imageBytes: maskBase64, mimeType: 'image/png' };
        maskRef.referenceId = 1;
        maskRef.config = {
            maskMode: MaskReferenceMode.MASK_MODE_USER_PROVIDED,
            maskDilation: 0.01,
        };

        const response = await client.models.editImage({
            model: 'imagen-3.0-capability-001',
            prompt: mode === 'remove' ? '' : prompt,
            referenceImages: [rawRef, maskRef],
            config: {
                editMode: mode === 'insert'
                    ? EditMode.EDIT_MODE_INPAINT_INSERTION
                    : EditMode.EDIT_MODE_INPAINT_REMOVAL,
                baseSteps: mode === 'insert' ? 35 : 12,
                numberOfImages: 1,
                personGeneration: 'ALLOW_ALL',
            },
        });

        return { success: true, generatedImages: response.generatedImages ?? [] };
    } catch (error) {
        console.error('[editImageVertex] Error:', error);
        return { success: false, error: error.message || 'Vertex AI editImage failed' };
    }
});



// [GLASS] Runtime OS-level blur: acrylic (Win11) / vibrancy (macOS)
ipcMain.handle('set-glass-level', (event, level) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    try {
        if (level === 'off') {
            if (process.platform === 'win32') {
                win.setBackgroundMaterial('none');
            } else if (process.platform === 'darwin') {
                win.setVibrancy(null);
            }
        } else {
            // 'transparent' or 'sunglasses'
            if (process.platform === 'win32') {
                win.setBackgroundMaterial('acrylic');
            } else if (process.platform === 'darwin') {
                win.setVibrancy('under-window');
            }
        }
    } catch (e) {
        console.warn('[Glass] setBackgroundMaterial/Vibrancy failed:', e.message);
    }
});

function createWindow(filePathToLoad = null) {
    // Load saved window state
    const savedState = loadWindowState();

    // Default bounds (used if no saved state)
    const defaultBounds = {
        width: 2560,
        height: 1440,
    };

    // Use saved bounds or defaults
    const windowOptions = {
        width: savedState?.width || defaultBounds.width,
        height: savedState?.height || defaultBounds.height,
        show: false,
        icon: path.join(__dirname, process.platform === 'win32' ? 'build/icon.ico' : process.platform === 'darwin' ? 'build/icon.icns' : 'build/icon.png'),
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            zoomFactor: 1.0,
            preload: path.join(__dirname, 'preload.js'),
        },
        // OS native title bar overlay: hides chrome but provides Windows 11 Snap Layouts on the maximize button
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#00000000',
            symbolColor: '#FFFFFF',
            height: 36,
        },
        hasShadow: true,
        // [GLASS] Use OS-native blur instead of transparent:true so that
        // native resize handles and titleBarOverlay maximize button work correctly.
        backgroundColor: '#00000000',
        minWidth: 600,
        minHeight: 400,
        ...(process.platform === 'win32' ? { backgroundMaterial: 'acrylic' } : {}),
        ...(process.platform === 'darwin' ? { vibrancy: 'under-window' } : {}),
    };

    // Add position if saved (and valid)
    if (savedState?.x !== undefined && savedState?.y !== undefined) {
        // Validate position is on a visible display
        const displays = screen.getAllDisplays();
        const isOnScreen = displays.some(display => {
            const bounds = display.workArea;
            return savedState.x >= bounds.x - 100 &&
                savedState.x < bounds.x + bounds.width &&
                savedState.y >= bounds.y - 100 &&
                savedState.y < bounds.y + bounds.height;
        });

        if (isOnScreen) {
            windowOptions.x = savedState.x;
            windowOptions.y = savedState.y;
        }
    }

    const browserWindow = new BrowserWindow(windowOptions);

    // [UX] Open external links in default browser
    browserWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:') || url.startsWith('http:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    // Each window has its own dirty state and workspace path
    browserWindow.isDirty = false;
    // Initialize workspace path (will be set when workspace is loaded/saved)
    if (filePathToLoad) {
        windowWorkspacePaths.set(browserWindow, filePathToLoad);
    }

    // Maximize if previously maximized, otherwise just show
    if (savedState?.isMaximized) {
        browserWindow.maximize();
    }
    browserWindow.show();
    // [FIX] Prevent Ctrl+Scroll / pinch-to-zoom from triggering Electron's native page zoom
    // Without this, rapid scrolling can trigger OS-level page zoom alongside canvas zoom
    browserWindow.webContents.setVisualZoomLevelLimits(1, 1);

    browserWindow.loadFile(path.join(__dirname, 'index.html'));

    browserWindow.setMenu(null);

    browserWindow.webContents.on('did-finish-load', () => {
        if (filePathToLoad) {
            loadWorkspaceFromFile(browserWindow, filePathToLoad);
        }
        // Flush any file paths that were queued while the window was still loading
        // (e.g. from second-instance events that arrived before did-finish-load)
        flushPendingFiles(browserWindow);
    });

    // [ELECTRON 40 FIX] OSR Paint Handler (for compatibility)
    browserWindow.webContents.on('paint', (event, dirty, handle) => {
        // In Electron 40, 'handle' contains: { sharedTextureHandle, planes, modifier }
        // This is a placeholder for future Zero-Copy implementation.
    });

    // [CRASH RECOVERY] Handle renderer process crash/OOM
    browserWindow.webContents.on('render-process-gone', (event, details) => {
        console.error('[Main] Renderer process gone:', details.reason, details.exitCode);

        const reasons = {
            'oom': 'Out of Memory - 메모리 부족으로 크래시',
            'killed': 'Process Killed - 프로세스가 강제 종료됨',
            'crashed': 'Process Crashed - 렌더러 프로세스 크래시',
            'launch-failed': 'Launch Failed - 렌더러 시작 실패',
            'integrity-failure': 'Integrity Failure - 코드 무결성 검사 실패',
        };

        const message = reasons[details.reason] || `Unknown error: ${details.reason}`;
        console.error('[Main] Crash reason:', message);

        // Auto-recovery for OOM and GPU-related crashes
        if (details.reason === 'oom' || details.reason === 'crashed') {
            console.log('[Main] Attempting auto-recovery...');

            // 새 세션 생성 — 크래시된 세션이 "이전 세션"으로 전환되어 복구 대상에 포함됨
            initTempSession();

            // Show notification to user
            dialog.showMessageBox({
                type: 'warning',
                title: 'BanaNyang - 복구 중',
                message: '앱이 크래시되어 복구를 시도합니다.',
                detail: `원인: ${message}\n\n이미지가 너무 많거나 VRAM이 부족할 수 있습니다.\n앱이 자동으로 재시작됩니다.`,
                buttons: ['확인'],
            }).then(() => {
                // Reload the window (이전 세션 데이터는 세션 폴더에 보존됨)
                browserWindow.reload();
            });
        }
    });

    // [CRASH RECOVERY] Handle unresponsive renderer
    browserWindow.webContents.on('unresponsive', () => {
        console.warn('[Main] Renderer became unresponsive');

        dialog.showMessageBox(browserWindow, {
            type: 'warning',
            title: 'BanaNyang - 응답 없음',
            message: '앱이 응답하지 않습니다.',
            detail: '잠시 기다리거나, 강제 종료 후 재시작하세요.\n\n대용량 이미지 처리 중일 수 있습니다.',
            buttons: ['대기', '강제 재시작'],
            defaultId: 0,
        }).then(({ response }) => {
            if (response === 1) {
                browserWindow.reload();
            }
        });
    });

    browserWindow.webContents.on('responsive', () => {
        console.log('[Main] Renderer became responsive again');
    });

    browserWindow.on('close', (e) => {
        // Save window state before closing
        saveWindowState(browserWindow);

        if (browserWindow.isDirty) {
            e.preventDefault();
            browserWindow.webContents.send('can-i-close');
        }
    });

    browserWindow.on('closed', () => {
        windows.delete(browserWindow);
    });

    windows.add(browserWindow);

    browserWindow.on('maximize', () => {
        browserWindow.webContents.send('maximize-changed', true);
    });

    browserWindow.on('unmaximize', () => {
        browserWindow.webContents.send('maximize-changed', false);
    });

    // F12 DevTools — 항상 허용
    browserWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12') {
            browserWindow.webContents.toggleDevTools();
            event.preventDefault();
        }
    });

    return browserWindow;
}

// Enable high DPI support for 4K and other high-resolution displays
app.commandLine.appendSwitch('high-dpi-support', '1');
// force-device-scale-factor removed: Windows DPI 설정과 동기화 (125%, 150%, 200% 자동 적용)

async function ensureThumbnailHandlerRegistered() {
    if (process.platform !== 'win32') return;
    const dllPath = app.isPackaged
        ? path.join(process.resourcesPath, 'bananyang_thumb.dll')
        : path.join(__dirname, 'shell-thumbnail-provider', 'target', 'x86_64-pc-windows-msvc', 'release', 'bananyang_thumb.dll');
    if (!fs.existsSync(dllPath)) {
        console.warn('[ThumbHandler] DLL not found at', dllPath);
        return;
    }
    return new Promise((resolve) => {
        exec(`regsvr32.exe /s "${dllPath}"`, (err) => {
            if (err) console.warn('[ThumbHandler] regsvr32 failed:', err.message);
            else console.log('[ThumbHandler] regsvr32 OK:', dllPath);
            resolve();
        });
    });
}

app.whenReady().then(() => {
    // Initialize temp file session management
    initTempSession();

    ensureThumbnailHandlerRegistered().catch(() => {});

    // 잔존 AI Studio OAuth 데이터 1회 정리 (기능 제거 마이그레이션)
    try {
        const store = drmStoreRead();
        if (store['ai_studio_oauth_refresh_token'] || store['ai_studio_oauth_email'] || store['ai_studio_oauth_project_id']) {
            delete store['ai_studio_oauth_refresh_token'];
            delete store['ai_studio_oauth_email'];
            delete store['ai_studio_oauth_project_id'];
            drmStoreWrite(store);
            console.log('[Cleanup] AI Studio OAuth 잔존 데이터 제거 완료');
        }
    } catch (e) {
        console.warn('[Cleanup] AI Studio OAuth 데이터 정리 실패:', e.message);
    }

    nativeTheme.themeSource = 'dark';

    createWindow(openFilePath);
    openFilePath = null; // Consumed

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (windows.size === 0) createWindow();
    });

    // [CRASH RECOVERY] Handle GPU process crash
    app.on('gpu-process-crashed', (event, killed) => {
        console.error('[Main] GPU process crashed, killed:', killed);

        // Notify all windows
        for (const win of windows) {
            if (!win.isDestroyed()) {
                dialog.showMessageBox(win, {
                    type: 'error',
                    title: 'BanaNyang - GPU 오류',
                    message: 'GPU 프로세스가 크래시되었습니다.',
                    detail: 'VRAM 부족 또는 GPU 드라이버 문제일 수 있습니다.\n\n앱을 재시작합니다.',
                    buttons: ['재시작'],
                }).then(() => {
                    win.reload();
                });
            }
        }
    });

    // [CRASH RECOVERY] Handle child process gone (includes GPU process)
    app.on('child-process-gone', (event, details) => {
        if (details.type === 'GPU') {
            console.error('[Main] GPU child process gone:', details.reason);

            for (const win of windows) {
                if (!win.isDestroyed()) {
                    win.reload();
                }
            }
        }
    });
});

const TEMP_DIR = path.join(app.getPath('temp'), 'bananyang-temp');
const SESSIONS_DIR = path.join(TEMP_DIR, 'sessions');
const STALE_SESSION_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// Current session ID (timestamp-based)
let currentSessionId = null;
let currentSessionDir = null;

/**
 * Initialize session directory for temp file management
 */
const INUSE_FILENAME = '.inuse';
// Sessions with .inuse mtime within this window are considered alive
const INUSE_CRASH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function initTempSession() {
    try {
        // Create sessions directory
        if (!fs.existsSync(SESSIONS_DIR)) {
            fs.mkdirSync(SESSIONS_DIR, { recursive: true });
        }

        // Generate new session ID
        currentSessionId = `session-${Date.now()}`;
        currentSessionDir = path.join(SESSIONS_DIR, currentSessionId);
        fs.mkdirSync(currentSessionDir, { recursive: true });

        // Write .inuse lock file to protect this session from cleanup by other instances
        fs.writeFileSync(path.join(currentSessionDir, INUSE_FILENAME), String(Date.now()));

        // Write session lock file (legacy)
        fs.writeFileSync(path.join(SESSIONS_DIR, '.session-lock'), currentSessionId);

        console.log(`[TempFileManager] Session initialized: ${currentSessionId}`);

        // Cleanup stale sessions on startup
        cleanupStaleSessions();
    } catch (error) {
        console.error('[TempFileManager] Failed to initialize session:', error);
        // Fallback to root temp dir
        currentSessionDir = TEMP_DIR;
    }
}

/**
 * Cleanup sessions older than threshold
 */
function cleanupStaleSessions() {
    try {
        if (!fs.existsSync(SESSIONS_DIR)) return;

        const sessions = fs.readdirSync(SESSIONS_DIR);
        const now = Date.now();
        let cleanedCount = 0;
        let cleanedBytes = 0;

        for (const sessionName of sessions) {
            if (sessionName.startsWith('.')) continue; // Skip lock files
            if (sessionName === currentSessionId) continue; // Skip current session

            const sessionPath = path.join(SESSIONS_DIR, sessionName);
            let stat;
            try { stat = fs.statSync(sessionPath); } catch { continue; }

            if (!stat.isDirectory()) continue;

            // Skip sessions that are actively in use by another app instance.
            // The .inuse file mtime is treated as a heartbeat; sessions that
            // crashed long ago (> INUSE_CRASH_THRESHOLD_MS) are still cleaned up.
            const inusePath = path.join(sessionPath, INUSE_FILENAME);
            if (fs.existsSync(inusePath)) {
                try {
                    const inuseStat = fs.statSync(inusePath);
                    const inuseAge = now - inuseStat.mtimeMs;
                    if (inuseAge < INUSE_CRASH_THRESHOLD_MS) {
                        console.log(`[TempFileManager] Skipping active session: ${sessionName}`);
                        continue;
                    }
                    // Crash remnant — fall through and clean up
                    console.log(`[TempFileManager] .inuse is stale (${Math.round(inuseAge / 86400000)}d old), cleaning: ${sessionName}`);
                } catch {
                    continue; // Can't stat .inuse, skip to be safe
                }
            }

            const age = now - stat.mtimeMs;
            if (age > STALE_SESSION_THRESHOLD_MS) {
                // Calculate size before deletion
                const sessionSize = getDirectorySize(sessionPath);
                cleanedBytes += sessionSize;

                // Delete old session
                fs.rmSync(sessionPath, { recursive: true, force: true });
                cleanedCount++;
                console.log(`[TempFileManager] Cleaned stale session: ${sessionName} (${Math.round(sessionSize / 1024)}KB)`);
            }
        }

        if (cleanedCount > 0) {
            console.log(`[TempFileManager] Cleaned ${cleanedCount} stale sessions, freed ${Math.round(cleanedBytes / (1024 * 1024))}MB`);
        }
    } catch (error) {
        console.error('[TempFileManager] Failed to cleanup stale sessions:', error);
    }
}

/**
 * Get directory size recursively
 */
function getDirectorySize(dirPath) {
    let totalSize = 0;
    try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                totalSize += getDirectorySize(filePath);
            } else {
                totalSize += stat.size;
            }
        }
    } catch (error) {
        // Ignore errors
    }
    return totalSize;
}

/**
 * Cleanup current session temp directory
 */
function cleanupCurrentSession() {
    try {
        if (currentSessionDir && fs.existsSync(currentSessionDir)) {
            // Remove .inuse lock before deleting so other instances can safely read the state
            try { fs.unlinkSync(path.join(currentSessionDir, INUSE_FILENAME)); } catch {}
            fs.rmSync(currentSessionDir, { recursive: true, force: true });
            console.log(`[TempFileManager] Current session cleaned: ${currentSessionId}`);
        }

        // Remove session lock
        const lockFile = path.join(SESSIONS_DIR, '.session-lock');
        if (fs.existsSync(lockFile)) {
            fs.unlinkSync(lockFile);
        }
    } catch (error) {
        console.error('[TempFileManager] Failed to cleanup current session:', error);
    }
}

// Legacy cleanup function for backwards compatibility
function cleanupTempDir() {
    cleanupCurrentSession();
}

app.on('will-quit', () => {
    cleanupTempDir();
});

// IPC Handler for autosave workspace to current session dir
ipcMain.handle('save-autosave-workspace', async (event, content) => {
    try {
        const targetDir = currentSessionDir || TEMP_DIR;
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const autosavePath = path.join(targetDir, 'workspace.bny.autosave');
        const tmpPath = autosavePath + '.tmp';
        fs.writeFileSync(tmpPath, content, 'utf-8');
        // Verify JSON before committing
        JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
        fs.renameSync(tmpPath, autosavePath);
        console.log('[AutoSave] Workspace autosaved to', autosavePath);
        return { success: true };
    } catch (error) {
        console.error('[AutoSave] Failed to save autosave workspace:', error);
        return { success: false, error: error.message };
    }
});

// [AUTOSAVE ZIP] Binary (ZIP container) autosave — accepts base64-encoded ZIP
ipcMain.handle('save-autosave-workspace-binary', async (event, base64) => {
    try {
        const targetDir = currentSessionDir || TEMP_DIR;
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const autosavePath = path.join(targetDir, 'workspace.bny.autosave');
        const tmpPath = autosavePath + '.tmp';
        const buffer = Buffer.from(base64, 'base64');
        // Verify ZIP magic before committing
        if (buffer.length < 4 ||
            buffer[0] !== 0x50 || buffer[1] !== 0x4B ||
            buffer[2] !== 0x03 || buffer[3] !== 0x04) {
            return { success: false, error: 'Invalid ZIP container' };
        }
        fs.writeFileSync(tmpPath, buffer);
        fs.renameSync(tmpPath, autosavePath);
        console.log('[AutoSave] Workspace autosaved (ZIP) to', autosavePath);
        return { success: true };
    } catch (error) {
        console.error('[AutoSave] Failed to save autosave workspace (binary):', error);
        return { success: false, error: error.message };
    }
});

// IPC Handler for saving to Temp (session-based)
ipcMain.handle('save-temp-file', async (event, { fileName, blob }) => {
    try {
        // Use session directory if available, fallback to root temp dir
        const targetDir = currentSessionDir || TEMP_DIR;

        // Ensure target dir exists
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const filePath = path.join(targetDir, fileName);

        let buffer;
        if (typeof blob === 'string') {
            const base64Data = blob.split(',')[1] || blob;
            buffer = Buffer.from(base64Data, 'base64');
        } else if (blob instanceof Uint8Array || Buffer.isBuffer(blob)) {
            buffer = Buffer.from(blob);
        } else {
            throw new Error('Unsupported blob format');
        }

        await fs.promises.writeFile(filePath, buffer);
        return { success: true, filePath };
    } catch (error) {
        console.error('Failed to save to temp:', error);
        return { success: false, error: error.message };
    }
});

// IPC Handler for getting temp file statistics
ipcMain.handle('get-temp-stats', async () => {
    try {
        const sessions = [];
        let totalFiles = 0;
        let totalSizeBytes = 0;

        if (fs.existsSync(SESSIONS_DIR)) {
            const sessionDirs = fs.readdirSync(SESSIONS_DIR);

            for (const sessionName of sessionDirs) {
                if (sessionName.startsWith('.')) continue;

                const sessionPath = path.join(SESSIONS_DIR, sessionName);
                const stat = fs.statSync(sessionPath);

                if (stat.isDirectory()) {
                    const files = fs.readdirSync(sessionPath);
                    const sessionSize = getDirectorySize(sessionPath);

                    sessions.push({
                        id: sessionName,
                        fileCount: files.length,
                        sizeBytes: sessionSize,
                        createdAt: stat.birthtimeMs,
                        isCurrent: sessionName === currentSessionId,
                    });

                    totalFiles += files.length;
                    totalSizeBytes += sessionSize;
                }
            }
        }

        return {
            success: true,
            data: {
                totalFiles,
                totalSizeBytes,
                totalSizeMB: Math.round(totalSizeBytes / (1024 * 1024) * 10) / 10,
                sessions,
                currentSessionId,
            }
        };
    } catch (error) {
        console.error('Failed to get temp stats:', error);
        return { success: false, error: error.message };
    }
});

// IPC Handler for cleaning up stale temp files
ipcMain.handle('cleanup-temp-files', async () => {
    try {
        const beforeStats = {
            files: 0,
            bytes: 0,
        };

        if (fs.existsSync(SESSIONS_DIR)) {
            const sessionDirs = fs.readdirSync(SESSIONS_DIR);

            for (const sessionName of sessionDirs) {
                if (sessionName.startsWith('.')) continue;
                if (sessionName === currentSessionId) continue; // Don't cleanup current session

                const sessionPath = path.join(SESSIONS_DIR, sessionName);
                const stat = fs.statSync(sessionPath);

                if (stat.isDirectory()) {
                    const files = fs.readdirSync(sessionPath);
                    beforeStats.files += files.length;
                    beforeStats.bytes += getDirectorySize(sessionPath);

                    fs.rmSync(sessionPath, { recursive: true, force: true });
                }
            }
        }

        return {
            success: true,
            cleaned: {
                files: beforeStats.files,
                bytes: beforeStats.bytes,
                megabytes: Math.round(beforeStats.bytes / (1024 * 1024) * 10) / 10,
            }
        };
    } catch (error) {
        console.error('Failed to cleanup temp files:', error);
        return { success: false, error: error.message };
    }
});

// ========================================
// [MEMORY V2] Session Recovery IPC Handlers
// ========================================

// Get list of recoverable sessions (previous sessions that weren't properly closed)
ipcMain.handle('get-recoverable-sessions', async () => {
    try {
        if (!fs.existsSync(SESSIONS_DIR)) {
            return { success: true, sessions: [] };
        }

        const sessionDirs = fs.readdirSync(SESSIONS_DIR)
            .filter(name => name.startsWith('session-') && name !== currentSessionId);

        const sessions = [];

        for (const sessionId of sessionDirs) {
            const sessionPath = path.join(SESSIONS_DIR, sessionId);

            try {
                const stat = fs.statSync(sessionPath);
                if (!stat.isDirectory()) continue;

                const files = fs.readdirSync(sessionPath);
                const imageFiles = files.filter(f =>
                    f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp')
                );

                // Skip empty sessions
                if (imageFiles.length === 0) continue;

                // Generate thumbnails (prefer tiny files, fallback to regular images)
                const thumbnails = [];
                const tinyFiles = files.filter(f => f.includes('_tiny'));
                const previewFiles = tinyFiles.length > 0 ? tinyFiles : imageFiles;

                for (const file of previewFiles.slice(0, 4)) {
                    try {
                        const filePath = path.join(sessionPath, file);
                        const base64 = fs.readFileSync(filePath).toString('base64');
                        const ext = path.extname(file).slice(1).toLowerCase();
                        const mimeType = ext === 'jpg' ? 'jpeg' : ext;
                        thumbnails.push(`data:image/${mimeType};base64,${base64}`);
                    } catch (e) {
                        // Skip failed thumbnails
                    }
                }

                // Check for autosave workspace file
                const workspaceFile = files.find(f => f.endsWith('.bny.autosave') || f.endsWith('.nyang.autosave'));

                // Calculate total session size
                let totalSize = 0;
                for (const file of files) {
                    try {
                        const fileStat = fs.statSync(path.join(sessionPath, file));
                        totalSize += fileStat.size;
                    } catch (e) { }
                }

                sessions.push({
                    id: sessionId,
                    createdAt: stat.birthtimeMs,
                    fileCount: imageFiles.length,
                    sizeBytes: totalSize,
                    thumbnails,
                    workspaceFile: workspaceFile ? path.join(sessionPath, workspaceFile) : null,
                });
            } catch (e) {
                console.warn(`[SessionRecovery] Failed to read session ${sessionId}:`, e);
            }
        }

        // Sort by creation time (newest first)
        sessions.sort((a, b) => b.createdAt - a.createdAt);

        console.log(`[SessionRecovery] Found ${sessions.length} recoverable sessions`);
        return { success: true, sessions };
    } catch (error) {
        console.error('[SessionRecovery] Failed to get recoverable sessions:', error);
        return { success: false, error: error.message, sessions: [] };
    }
});

// Recover images from a previous session
ipcMain.handle('recover-session', async (_, sessionId) => {
    try {
        const sessionPath = path.join(SESSIONS_DIR, sessionId);

        if (!fs.existsSync(sessionPath)) {
            return { success: false, error: 'Session not found' };
        }

        const files = fs.readdirSync(sessionPath);

        // Check for workspace autosave file first
        const workspaceFile = files.find(f => f.endsWith('.bny.autosave') || f.endsWith('.nyang.autosave'));
        if (workspaceFile) {
            const workspacePath = path.join(sessionPath, workspaceFile);
            const buffer = fs.readFileSync(workspacePath);

            // Detect ZIP container (new format) vs legacy JSON text
            const isZip = buffer.length >= 4 &&
                buffer[0] === 0x50 && buffer[1] === 0x4B &&
                buffer[2] === 0x03 && buffer[3] === 0x04;

            console.log(`[SessionRecovery] Recovering workspace from ${workspacePath} (${isZip ? 'ZIP' : 'JSON'})`);
            if (isZip) {
                return {
                    success: true,
                    workspaceBase64: buffer.toString('base64'),
                    restoredImages: 0,
                };
            }
            return {
                success: true,
                workspaceContent: buffer.toString('utf-8'),
                restoredImages: 0,
            };
        }

        // No workspace file - return list of image files for manual recovery
        const imageFiles = files.filter(f =>
            (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp')) &&
            !f.includes('_tiny') && !f.includes('_proxy')
        );

        const images = [];
        for (const file of imageFiles) {
            const filePath = path.join(sessionPath, file);
            images.push({
                filename: file,
                path: filePath,
                url: `file:///${filePath.replace(/\\/g, '/')}`,
            });
        }

        console.log(`[SessionRecovery] Recovering ${images.length} images from session ${sessionId}`);
        return {
            success: true,
            images,
            restoredImages: images.length,
        };
    } catch (error) {
        console.error('[SessionRecovery] Failed to recover session:', error);
        return { success: false, error: error.message };
    }
});

// Delete a recoverable session
ipcMain.handle('delete-session', async (_, sessionId) => {
    try {
        // Safety check: don't allow deleting current session
        if (sessionId === currentSessionId) {
            return { success: false, error: 'Cannot delete current session' };
        }

        const sessionPath = path.join(SESSIONS_DIR, sessionId);

        if (fs.existsSync(sessionPath)) {
            const size = getDirectorySize(sessionPath);
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`[SessionRecovery] Deleted session ${sessionId} (${Math.round(size / 1024)}KB)`);
        }

        return { success: true };
    } catch (error) {
        console.error('[SessionRecovery] Failed to delete session:', error);
        return { success: false, error: error.message };
    }
});

// ========================================
// [GPU MONITOR] GPU Info and VRAM Monitoring
// ========================================

// Cache GPU info to avoid repeated calls
let cachedGpuInfo = null;

// Get GPU info (cached after first call)
ipcMain.handle('get-gpu-info', async () => {
    try {
        if (cachedGpuInfo) {
            return { success: true, data: cachedGpuInfo };
        }

        // Use Electron's built-in GPU info
        const gpuInfo = await app.getGPUInfo('complete');

        // Extract relevant info
        const gpuDevice = gpuInfo.gpuDevice?.[0] || {};

        cachedGpuInfo = {
            vendorId: gpuDevice.vendorId,
            deviceId: gpuDevice.deviceId,
            description: gpuDevice.driverDescription || 'Unknown GPU',
            driverVersion: gpuDevice.driverVersion,
            totalMemoryBytes: null,
        };

        // Try to get GPU info on Windows
        if (process.platform === 'win32') {
            // First try nvidia-smi for NVIDIA GPUs (accurate for >4GB VRAM)
            try {
                const nvidiaResult = await new Promise((resolve) => {
                    exec('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits',
                        { timeout: 3000 },
                        (error, stdout) => {
                            if (error) {
                                resolve(null);
                            } else {
                                try {
                                    const parts = stdout.trim().split(',').map(s => s.trim());
                                    if (parts.length >= 2) {
                                        resolve({
                                            name: parts[0],
                                            totalMB: parseInt(parts[1])
                                        });
                                    } else {
                                        resolve(null);
                                    }
                                } catch {
                                    resolve(null);
                                }
                            }
                        }
                    );
                });

                if (nvidiaResult && nvidiaResult.totalMB > 0) {
                    cachedGpuInfo.description = nvidiaResult.name;
                    cachedGpuInfo.totalMemoryBytes = nvidiaResult.totalMB * 1024 * 1024;
                    console.log(`[GPU Monitor] NVIDIA GPU detected: ${nvidiaResult.name}, ${nvidiaResult.totalMB}MB VRAM`);
                    return { success: true, data: cachedGpuInfo };
                }
            } catch (e) {
                console.warn('[GPU Monitor] nvidia-smi failed, trying WMI:', e);
            }

            // Fallback: Try WMI with qwMemorySize (supports >4GB)
            try {
                const wmiResult = await new Promise((resolve) => {
                    // Use Get-CimInstance with more accurate memory property
                    const psCommand = `Get-CimInstance -Namespace root/cimv2 -ClassName Win32_VideoController | Select-Object -First 1 Name, @{N='MemoryBytes';E={$_.AdapterRAM}} | ConvertTo-Json`;
                    exec(`powershell -Command "${psCommand}"`,
                        { timeout: 5000 },
                        (error, stdout) => {
                            if (error) {
                                resolve(null);
                            } else {
                                try {
                                    const data = JSON.parse(stdout);
                                    resolve(data);
                                } catch {
                                    resolve(null);
                                }
                            }
                        }
                    );
                });

                if (wmiResult) {
                    cachedGpuInfo.description = wmiResult.Name || cachedGpuInfo.description;
                    // AdapterRAM is 32-bit limited (max 4GB), so only use if nvidia-smi failed
                    // For GPUs >4GB, this will be wrong, but we'll try to detect from usage
                    if (wmiResult.MemoryBytes && wmiResult.MemoryBytes > 0) {
                        cachedGpuInfo.totalMemoryBytes = wmiResult.MemoryBytes;
                    }
                }
            } catch (e) {
                console.warn('[GPU Monitor] WMI query failed:', e);
            }
        } else if (process.platform === 'darwin') {
            // macOS: Use system_profiler to get GPU/VRAM info
            try {
                const macResult = await new Promise((resolve) => {
                    exec('system_profiler SPDisplaysDataType -json', { timeout: 5000 }, (error, stdout) => {
                        if (error) {
                            resolve(null);
                        } else {
                            try {
                                const data = JSON.parse(stdout);
                                const displays = data['SPDisplaysDataType'];
                                if (displays && displays.length > 0) {
                                    const gpu = displays[0];
                                    const name = gpu['_name'] || gpu['spdisplays_vendor'] || null;
                                    // VRAM field: "spdisplays_vram" e.g. "8 GB" or "Shared"
                                    const vramStr = gpu['spdisplays_vram'] || gpu['spdisplays_vram_shared'] || null;
                                    let totalBytes = null;
                                    if (vramStr && vramStr !== 'Shared') {
                                        const match = vramStr.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
                                        if (match) {
                                            const val = parseFloat(match[1]);
                                            totalBytes = match[2].toUpperCase() === 'GB'
                                                ? val * 1024 * 1024 * 1024
                                                : val * 1024 * 1024;
                                        }
                                    }
                                    resolve({ name, totalBytes });
                                } else {
                                    resolve(null);
                                }
                            } catch {
                                resolve(null);
                            }
                        }
                    });
                });

                if (macResult) {
                    if (macResult.name) cachedGpuInfo.description = macResult.name;
                    if (macResult.totalBytes) cachedGpuInfo.totalMemoryBytes = macResult.totalBytes;
                    console.log(`[GPU Monitor] macOS GPU: ${cachedGpuInfo.description}, VRAM: ${macResult.totalBytes ? Math.round(macResult.totalBytes / (1024 * 1024)) + 'MB' : 'Shared/Unknown'}`);
                }
            } catch (e) {
                console.warn('[GPU Monitor] system_profiler failed:', e);
            }
        }

        return { success: true, data: cachedGpuInfo };
    } catch (error) {
        console.error('[GPU Monitor] Failed to get GPU info:', error);
        return { success: false, error: error.message };
    }
});

// Get real-time GPU memory usage (Windows only, uses Performance Counters)
ipcMain.handle('get-gpu-memory-usage', async () => {
    try {
        if (process.platform !== 'win32') {
            return { success: false, error: 'GPU memory monitoring is only supported on Windows' };
        }

        // Use PowerShell to get GPU memory usage from Performance Counters
        // This matches Windows Task Manager's GPU memory display
        const result = await new Promise((resolve, reject) => {
            const psCommand = `
                $ErrorActionPreference = 'SilentlyContinue'
                $dedicatedUsage = (Get-Counter '\\GPU Adapter Memory(*)\\Dedicated Usage' -ErrorAction SilentlyContinue).CounterSamples |
                    Where-Object { $_.InstanceName -notlike '*engtype*' } |
                    Measure-Object -Property CookedValue -Sum
                $sharedUsage = (Get-Counter '\\GPU Adapter Memory(*)\\Shared Usage' -ErrorAction SilentlyContinue).CounterSamples |
                    Where-Object { $_.InstanceName -notlike '*engtype*' } |
                    Measure-Object -Property CookedValue -Sum
                @{
                    dedicatedBytes = [long]$dedicatedUsage.Sum
                    sharedBytes = [long]$sharedUsage.Sum
                } | ConvertTo-Json
            `.replace(/\n/g, ' ');

            exec(`powershell -Command "${psCommand}"`, { timeout: 3000 }, (error, stdout, stderr) => {
                if (error) {
                    // Fallback: try nvidia-smi for NVIDIA GPUs
                    exec('nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits',
                        { timeout: 2000 },
                        (nvidiaError, nvidiaStdout) => {
                            if (nvidiaError) {
                                reject(new Error('Failed to get GPU memory usage'));
                            } else {
                                const [used, total] = nvidiaStdout.trim().split(',').map(s => parseInt(s.trim()) * 1024 * 1024);
                                resolve({ dedicatedBytes: used, sharedBytes: 0, totalBytes: total, source: 'nvidia-smi' });
                            }
                        }
                    );
                } else {
                    try {
                        const data = JSON.parse(stdout);
                        data.source = 'perfcounter';
                        resolve(data);
                    } catch (parseError) {
                        reject(new Error('Failed to parse GPU memory data'));
                    }
                }
            });
        });

        return {
            success: true,
            data: {
                dedicatedBytes: result.dedicatedBytes || 0,
                sharedBytes: result.sharedBytes || 0,
                totalBytes: result.totalBytes || null,
                source: result.source || 'perfcounter',
                timestamp: Date.now(),
            }
        };
    } catch (error) {
        console.error('[GPU Monitor] Failed to get GPU memory usage:', error);
        return { success: false, error: error.message };
    }
});

// ========================================
// [DRM] safeStorage — OS 레벨 암호화 (AES-256 via Keychain/DPAPI)
// ========================================
const { safeStorage } = require('electron');
const DRM_STORE_FILE = path.join(app.getPath('userData'), 'drm-store.json');

function drmStoreRead() {
    try {
        if (fs.existsSync(DRM_STORE_FILE)) {
            return JSON.parse(fs.readFileSync(DRM_STORE_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error('[DRM] Failed to read store:', e);
    }
    return {};
}

function drmStoreWrite(data) {
    try {
        fs.writeFileSync(DRM_STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error('[DRM] Failed to write store:', e);
    }
}

ipcMain.handle('safe-storage-set', async (_event, { key, value }) => {
    try {
        const store = drmStoreRead();
        if (safeStorage.isEncryptionAvailable()) {
            store[key] = safeStorage.encryptString(value).toString('base64');
        } else {
            // Fallback: base64 encoding (not encrypted, but obfuscated)
            store[key] = Buffer.from(value).toString('base64');
        }
        drmStoreWrite(store);
    } catch (e) {
        console.error('[DRM] safeStorageSet error:', e);
    }
});

ipcMain.handle('safe-storage-get', async (_event, { key }) => {
    try {
        const store = drmStoreRead();
        const encoded = store[key];
        if (!encoded) return null;

        if (safeStorage.isEncryptionAvailable()) {
            return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
        } else {
            return Buffer.from(encoded, 'base64').toString('utf-8');
        }
    } catch (e) {
        console.error('[DRM] safeStorageGet error:', e);
        return null;
    }
});

ipcMain.handle('safe-storage-delete', async (_event, { key }) => {
    try {
        const store = drmStoreRead();
        delete store[key];
        drmStoreWrite(store);
    } catch (e) {
        console.error('[DRM] safeStorageDelete error:', e);
    }
});

ipcMain.handle('safe-storage-availability', async () => {
    return { available: safeStorage.isEncryptionAvailable() };
});

// ========================================
// [AUTO-UPDATE] electron-updater (Firebase Storage GenericProvider)
// ========================================
const { autoUpdater } = require('electron-updater');

// 백엔드: Firebase Storage releases/{platform}/latest.yml
const FIREBASE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'bananyang-ai.firebasestorage.app';
const updatePlatformDir = process.platform === 'darwin' ? 'mac' : 'win';
try {
    autoUpdater.setFeedURL({
        provider: 'generic',
        url: `https://storage.googleapis.com/${FIREBASE_BUCKET}/releases/${updatePlatformDir}`,
        channel: 'latest',
    });
} catch (e) {
    console.error('[AutoUpdate] setFeedURL failed:', e);
}

// 자동 다운로드는 정책에 따라 main에서 트리거. autoDownload는 false 유지.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// 정책 상태 (렌더러가 부팅/토글 변경 시 갱신)
let updatePolicy = 'silent'; // 'silent' | 'prompt'
let lastSeenSeverity = 'optional'; // 'optional' | 'recommended' | 'critical'

function sendUpdateStatus(status) {
    for (const win of windows) {
        try { win.webContents.send('update-status', status); } catch { }
    }
}

autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ state: 'checking' });
});

autoUpdater.on('update-available', (info) => {
    sendUpdateStatus({ state: 'available', version: info.version, severity: lastSeenSeverity });
    // silent 모드 또는 critical → 즉시 다운로드. prompt 모드는 사용자 확인 후 download-update IPC.
    if (updatePolicy === 'silent' || lastSeenSeverity === 'critical') {
        autoUpdater.downloadUpdate().catch(err => {
            console.error('[AutoUpdate] auto downloadUpdate failed:', err);
        });
    }
});

autoUpdater.on('update-not-available', () => {
    sendUpdateStatus({ state: 'not-available' });
});

autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({ state: 'downloading', percent: Math.round(progress.percent) });
});

autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ state: 'downloaded', version: info.version, severity: lastSeenSeverity });
    // critical: 렌더러 측 모달이 '지금 재시작' 강제.
    // silent: autoInstallOnAppQuit=true → 다음 종료 시 자동 적용. 사용자 방해 X.
});

autoUpdater.on('error', (err) => {
    sendUpdateStatus({ state: 'error', message: err?.message ?? 'Unknown error' });
});

ipcMain.handle('check-for-updates', async () => {
    try {
        await autoUpdater.checkForUpdates();
    } catch (e) {
        console.error('[AutoUpdate] checkForUpdates error:', e);
    }
});

ipcMain.handle('download-update', async () => {
    try {
        await autoUpdater.downloadUpdate();
    } catch (e) {
        console.error('[AutoUpdate] downloadUpdate error:', e);
    }
});

ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
});

ipcMain.handle('update:set-policy', async (_event, payload) => {
    const policy = payload && payload.policy;
    const severity = payload && payload.severity;
    if (policy === 'silent' || policy === 'prompt') updatePolicy = policy;
    if (typeof severity === 'string') lastSeenSeverity = severity;
});

ipcMain.handle('update:apply-now', () => {
    try {
        autoUpdater.quitAndInstall(false, true);
    } catch (e) {
        console.error('[AutoUpdate] applyUpdateNow error:', e);
    }
});

ipcMain.handle('refresh-thumbnail-handler', async () => {
    if (process.platform !== 'win32') return { success: false, reason: 'not-win32' };
    const dllPath = app.isPackaged
        ? path.join(process.resourcesPath, 'bananyang_thumb.dll')
        : path.join(__dirname, 'shell-thumbnail-provider', 'target', 'x86_64-pc-windows-msvc', 'release', 'bananyang_thumb.dll');
    if (!fs.existsSync(dllPath)) return { success: false, reason: 'dll-not-found', dllPath };
    return new Promise((resolve) => {
        exec(`regsvr32.exe /s /u "${dllPath}"`, () => {
            exec(`regsvr32.exe /s "${dllPath}"`, (err) => {
                if (err) { resolve({ success: false, reason: 'regsvr32-failed', error: err.message }); return; }
                exec('ie4uinit.exe -show', () => resolve({ success: true, dllPath }));
            });
        });
    });
});

// 앱 시작 5초 후 자동 업데이트 확인
app.whenReady().then(() => {
    setTimeout(() => {
        try { autoUpdater.checkForUpdates(); } catch { }
    }, 5000);
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// Handle file opening on macOS
app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (app.isReady()) {
        // If app is running, load file as a new workspace tab in the existing window.
        const targetWindow = Array.from(windows).pop();
        if (targetWindow) {
            if (targetWindow.isMinimized()) targetWindow.restore();
            targetWindow.focus();
            sendWorkspaceFileToWindow(targetWindow, filePath);
        } else {
            // No window exists — create one with this file
            createWindow(filePath);
        }
    } else {
        // If app is not running, this is the file that launched it.
        // Queue it to be opened by the first window.
        openFilePath = filePath;
    }
});