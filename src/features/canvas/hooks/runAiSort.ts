import { canvasStoreRegistry } from '../../../store/canvasStore';
import { useWorkspaceTabsStore } from '../../../store/workspaceTabsStore';
import { t, type Language } from '../../../localization';
import type { AxisMode } from '../../../services/aiSortService';

interface AiSortRunOpts {
    axis: AxisMode;
    maxGroups: number | 'auto';
    verifyClusters: boolean;
}

export async function runAiSort(
    tabId: string,
    language: Language,
    opts: AiSortRunOpts,
    onNotification: (msg: string, type: 'success' | 'error') => void,
): Promise<void> {
    const inst = canvasStoreRegistry.getInstance(tabId);
    if (!inst) {
        onNotification(t('aiSort.error', language), 'error');
        return;
    }

    const { setTabLoadingState, clearTabLoadingState } = useWorkspaceTabsStore.getState();

    setTabLoadingState(tabId, {
        isLoading: true,
        message: t('aiSort.analyzing', language),
        progress: 5,
        isReversed: false,
        variant: 'glass',
    });

    try {
        await inst.getState().aiSortImages(
            (percent, status) => setTabLoadingState(tabId, { message: status, progress: percent }),
            opts,
        );
        onNotification(t('aiSort.complete', language), 'success');
    } catch (err) {
        console.error('[aiSort] failed:', err);
        onNotification(t('aiSort.error', language), 'error');
    } finally {
        clearTabLoadingState(tabId);
    }
}
