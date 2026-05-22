import type { IElectronAPI } from '../electron';

declare global {
    interface Window {
        showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
        showSaveFilePicker?: (options?: any) => Promise<FileSystemFileHandle>;
        showOpenFilePicker?: (options?: any) => Promise<FileSystemFileHandle[]>;
        electronAPI: IElectronAPI;
    }
    interface FileSystemDirectoryHandle {
        name: string;
        queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
        requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
        removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
        getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    }
    interface FileSystemFileHandle {
        createWritable(): Promise<FileSystemWritableFileStream>;
        getFile(): Promise<File>;
    }
    interface FileSystemWritableFileStream extends WritableStream {
        write(data: any): Promise<void>;
        close(): Promise<void>;
    }
    interface ClipboardItem {
        new(data: { [mimeType: string]: Blob }): ClipboardItem;
    }

    type SnapCandidate = {
        id?: string;
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export {};
