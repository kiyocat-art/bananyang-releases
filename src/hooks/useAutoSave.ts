import { useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useSettingsStore } from '../store/settingsStore';
import { fileToBase64 } from '../services/geminiService';
import { ensureBoardImageFile } from '../utils/imageUtils';

const AUTOSAVE_CHECK_INTERVAL = 60_000; // 60초마다 체크

export function useAutoSave(): void {
  useEffect(() => {
    const hasAutosave = window.electronAPI?.saveAutosaveWorkspaceBinary ?? window.electronAPI?.saveAutosaveWorkspace;
    if (!hasAutosave) return;

    const interval = setInterval(async () => {
      const { shouldAutoSave, resetAutoSaveTracking } = useSettingsStore.getState();
      const { shouldSave } = shouldAutoSave();
      if (!shouldSave) return;

      const { boardImages: imgs, boardGroups: groups, memos: ms, leftPanelTab: tab } = useCanvasStore.getState();
      if (imgs.length === 0 && groups.length === 0 && ms.length === 0) return;

      try {
        const serializableImages = await Promise.all(
          imgs.map(async (img) => {
            let fileToSave = (img.isGenerated && img.originalFile) ? img.originalFile : img.file;
            if (!fileToSave) {
              fileToSave = await ensureBoardImageFile(img, (img.isGenerated && img.originalFile) ? 'original' : 'display');
            }
            if (!fileToSave) return null;

            const base64 = await fileToBase64(fileToSave);
            const {
              file, originalFile, src, thumbnailSrc, originalSrc,
              tinySrc, proxySrc, previewSrc, ktx2Src, highResSrc,
              tinyFile, proxyFile, previewFile, maskSrc, maskFile,
              filePath, originalFilePath, tinyFilePath, proxyFilePath,
              ...rest
            } = img;

            return {
              ...rest,
              fileData: { name: fileToSave.name, type: fileToSave.type, base64 },
              isGenerated: img.isGenerated,
              originalDimensions: img.originalDimensions,
            };
          })
        );

        const workspaceData = {
          version: '1.4',
          boardImages: serializableImages.filter(Boolean),
          boardGroups: groups,
          memos: ms,
          leftPanelTab: tab,
        };

        if (window.electronAPI?.saveAutosaveWorkspaceBinary) {
          const { packWorkspaceZip } = await import('../utils/workspaceContainer');
          const zipBytes = packWorkspaceZip({ workspaceJson: JSON.stringify(workspaceData) });
          const result = await window.electronAPI.saveAutosaveWorkspaceBinary(zipBytes);
          if (result.success) resetAutoSaveTracking();
        } else if (window.electronAPI?.saveAutosaveWorkspace) {
          // Legacy fallback (old preload without binary support)
          const result = await window.electronAPI.saveAutosaveWorkspace(JSON.stringify(workspaceData));
          if (result.success) resetAutoSaveTracking();
        }
      } catch (err) {
        console.error('[AutoSave] Failed:', err);
      }
    }, AUTOSAVE_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, []);
}
