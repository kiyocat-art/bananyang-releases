// IndexedDB를 사용하여 FileSystemDirectoryHandle을 저장/로드/삭제
const DB_NAME = 'bananyang-db';
const STORE_NAME = 'file-handles';
const KEY = 'saveDirectoryHandle';

// [FIX B-4] Added retryCount to prevent infinite recursion
function openDB(retryCount = 0): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            // object store가 존재하는지 확인
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.close();
                if (retryCount >= 1) {
                    reject(new Error('Failed to create object store after retry'));
                    return;
                }
                // store가 없으면 DB를 삭제하고 재생성
                const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
                deleteRequest.onsuccess = () => {
                    // 재귀적으로 다시 열기 (onupgradeneeded가 실행됨)
                    openDB(retryCount + 1).then(resolve).catch(reject);
                };
                deleteRequest.onerror = () => reject(deleteRequest.error);
                return;
            }
            resolve(db);
        };
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

export async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(handle, KEY);
            request.onsuccess = () => {
                db.close();
                resolve();
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.warn('[idb] saveHandle failed:', e);
        throw e;
    }
}

export async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(KEY);
            request.onsuccess = () => {
                db.close();
                resolve(request.result || null);
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.warn('[idb] loadHandle failed:', e);
        return null; // 오류 시 null 반환 (graceful fallback)
    }
}

export async function clearHandle(): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(KEY);
            request.onsuccess = () => {
                db.close();
                resolve();
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.warn('[idb] clearHandle failed:', e);
        // 삭제 실패해도 무시 (graceful)
    }
}