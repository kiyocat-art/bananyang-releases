import { PromptFolder } from './types';

export interface IElectronAPI {
  onLoadWorkspace: (callback: (filePath: string | null, fileContent: string) => void) => () => void;
  setDirty: (isDirty: boolean) => void;
  onCanClose: (callback: () => void) => () => void;
  confirmClose: () => void;
  onSaveAndQuit: (callback: () => void) => () => void;
  savedAndReadyToQuit: () => void;
  saveFile: (filePath: string, content: string) => Promise<boolean>;
  saveAs: (content: string) => Promise<{ success: boolean; filePath: string | null; error?: string; }>;
  saveWorkspaceFile: (filePath: string, data: Uint8Array) => Promise<boolean>;
  saveWorkspaceAs: (data: Uint8Array, defaultName?: string | null) => Promise<{ success: boolean; filePath: string | null; error?: string; }>;
  readWorkspaceFile: (filePath: string) => Promise<{ base64: string; size: number } | null>;
  renameWorkspaceFile: (oldPath: string, newName: string) => Promise<string>;
  saveAutosaveWorkspaceBinary: (data: Uint8Array) => Promise<{ success: boolean; error?: string }>;
  // FIX: Changed return type to match main.js implementation, which returns a file path string or null.
  openFileDialog: () => Promise<string | null>;
  getPathForFile: (file: File) => string | null;
  // FIX: Added missing readFile method to match preload.js exposure.
  readFile: (filePath: string) => Promise<string | null>;
  // [NEW] Read binary file as base64 - for images and other binary data
  readBinaryFile: (filePath: string) => Promise<string | null>;
  // [NEW] Check if file exists on disk (lightweight)
  fileExists: (filePath: string) => Promise<boolean>;
  writeImage: (dataUrl: string) => void;
  readImage: () => Promise<string | null>;
  minimizeWindow: () => void;
  closeWindow: () => void;
  toggleAlwaysOnTop: () => void;
  onAlwaysOnTopChanged: (callback: (value: boolean) => void) => void;
  onMaximizeChanged: (callback: (value: boolean) => void) => void;
  loadPresets: () => Promise<PromptFolder[] | null>;
  savePresets: (folders: PromptFolder[]) => Promise<boolean>;
  quitApp: () => void;
  restartApp: () => void;
createBlankWorkspace: () => void;
  startAuthServer: () => Promise<{ success: boolean; code?: string; error?: string }>;
  openExternal: (url: string) => void;
  generateContentVertex: (params: any) => Promise<any>;
  editImageVertex: (params: { originalBase64: string; maskBase64: string; mimeType: string; prompt: string; mode: 'insert' | 'remove' }) => Promise<{ success: boolean; generatedImages?: any[]; error?: string }>;
  selectDirectory: () => Promise<string | null>;
  openFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  saveFileToDirectory: (directoryPath: string, fileName: string, blob: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  clearAppCache: () => Promise<boolean>;
  setWindowTitle: (title: string) => void;
  saveTempFile: (fileName: string, blob: string | Uint8Array) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  copyFile: (sourcePath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
  getTempStats: () => Promise<{
    success: boolean;
    data?: {
      totalFiles: number;
      totalSizeBytes: number;
      totalSizeMB: number;
      sessions: Array<{
        id: string;
        fileCount: number;
        sizeBytes: number;
        createdAt: number;
        isCurrent: boolean;
      }>;
      currentSessionId: string | null;
    };
    error?: string;
  }>;
  cleanupTempFiles: () => Promise<{
    success: boolean;
    cleaned?: {
      files: number;
      bytes: number;
      megabytes: number;
    };
    error?: string;
  }>;
  // [AUTOSAVE] Save workspace to current session dir
  saveAutosaveWorkspace: (content: string) => Promise<{ success: boolean; error?: string }>;
  // [MEMORY V2] Session Recovery APIs
  getRecoverableSessions: () => Promise<{
    success: boolean;
    sessions: Array<{
      id: string;
      createdAt: number;
      fileCount: number;
      sizeBytes: number;
      thumbnails: string[];
      workspaceFile: string | null;
    }>;
    error?: string;
  }>;
  recoverSession: (sessionId: string) => Promise<{
    success: boolean;
    workspaceContent?: string;
    workspaceBase64?: string;
    images?: Array<{ filename: string; path: string; url: string }>;
    restoredImages: number;
    error?: string;
  }>;
  deleteSession: (sessionId: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  // [GPU MONITOR] GPU Info and VRAM Monitoring APIs
  getGpuInfo: () => Promise<{
    success: boolean;
    data?: {
      vendorId?: number;
      deviceId?: number;
      description: string;
      driverVersion?: string;
      totalMemoryBytes: number | null;
    };
    error?: string;
  }>;
  getGpuMemoryUsage: () => Promise<{
    success: boolean;
    data?: {
      dedicatedBytes: number;
      sharedBytes: number;
      totalBytes: number | null;
      source: 'perfcounter' | 'nvidia-smi';
      timestamp: number;
    };
    error?: string;
  }>;
  // [DRM] safeStorage — OS 레벨 암호화
  safeStorageSet: (key: string, value: string) => Promise<void>;
  safeStorageGet: (key: string) => Promise<string | null>;
  safeStorageDelete: (key: string) => Promise<void>;
  // [DRM] Google OAuth for Firebase
  startGoogleOAuth?: () => Promise<{ success: boolean; accessToken?: string; error?: string }>;
  // [VERTEX AI ADC] 앱 내 Google Cloud 인증
  googleAuthStart?: (projectId: string) => Promise<{ success: boolean; email?: string; projectId?: string; accessToken?: string | null; error?: string }>;
  googleAuthCancel?: () => Promise<{ success: boolean }>;
  googleAuthStatus?: () => Promise<{ hasAdc: boolean; type?: string; projectId?: string | null }>;
  googleAuthRefresh?: () => Promise<{ success: boolean; accessToken?: string; error?: string }>;
  googleAuthLogout?: () => Promise<{ success: boolean }>;
  googleAuthSetProject?: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  googleAuthListProjects?: (accessToken?: string | null) => Promise<{ success: boolean; projects?: { projectId: string; name: string }[]; error?: string }>;
  // [GLASS] OS-level acrylic/vibrancy blur
  setGlassLevel?: (level: 'transparent' | 'sunglasses' | 'off') => Promise<void>;
  // [THUMB HANDLER] 썸네일 핸들러 수동 재등록
  refreshThumbnailHandler?: () => Promise<{ success: boolean; reason?: string; error?: string; dllPath?: string }>;
  // [AUTO-UPDATE] electron-updater
  checkForUpdates?: () => Promise<void>;
  downloadUpdate?: () => Promise<void>;
  installUpdate?: () => Promise<void>;
  setUpdatePolicy?: (policy: 'silent' | 'prompt', severity?: string) => Promise<void>;
  applyUpdateNow?: () => Promise<void>;
  onUpdateStatus?: (callback: (status: {
    state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
    version?: string;
    percent?: number;
    message?: string;
    severity?: 'optional' | 'recommended' | 'critical' | string;
  }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}