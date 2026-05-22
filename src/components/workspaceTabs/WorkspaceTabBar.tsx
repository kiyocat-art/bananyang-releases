import React, { useRef, useState } from 'react';
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useWorkspaceTabsStore, useIsAnyTabLoading } from '../../store/workspaceTabsStore';
import { useUIStore } from '../../store/uiStore';
import { useSettingsStore } from '../../store/settingsStore';
import { t } from '../../localization';
import { WorkspaceTabItem } from './WorkspaceTab';
import { NewTabButton } from './NewTabButton';
import { TabContextMenu } from './TabContextMenu';
import { HoverEdgeAutoScroll } from '../HoverEdgeAutoScroll';

interface ContextMenuState {
    x: number;
    y: number;
    tabId: string;
    filePath: string | null;
}

interface WorkspaceTabBarProps {
    onRequestCloseTab?: (tabId: string) => void;
}

export const WorkspaceTabBar: React.FC<WorkspaceTabBarProps> = ({ onRequestCloseTab }) => {
    const tabs = useWorkspaceTabsStore(s => s.tabs);
    const activeTabId = useWorkspaceTabsStore(s => s.activeTabId);
    const { createTab, closeTab, activateTab, reorderTabs, updateTabMeta, closeOtherTabs, closeTabsToTheRight } = useWorkspaceTabsStore.getState();
    const isAnyTabLoading = useIsAnyTabLoading();

    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const tabScrollRef = useRef<HTMLDivElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const fromIndex = tabs.findIndex(t => t.id === active.id);
        const toIndex = tabs.findIndex(t => t.id === over.id);
        if (fromIndex !== -1 && toIndex !== -1) reorderTabs(fromIndex, toIndex);
    };

    const handleContextMenu = (e: React.MouseEvent, tabId: string, filePath: string | null) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, tabId, filePath });
    };

    const handleClose = (tabId: string) => {
        if (onRequestCloseTab) {
            onRequestCloseTab(tabId);
        } else {
            closeTab(tabId);
        }
    };

    return (
        <div
            className="flex items-center w-full h-full overflow-hidden"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <div
                className="relative flex items-stretch h-full overflow-hidden"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
            <div
                ref={tabScrollRef}
                className="flex items-stretch h-full overflow-x-auto overflow-y-hidden scrollbar-none"
            >
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                        {tabs.map(tab => (
                            <WorkspaceTabItem
                                key={tab.id}
                                tab={tab}
                                isActive={tab.id === activeTabId}
                                onActivate={() => {
                                    if (isAnyTabLoading && tab.id !== activeTabId) {
                                        useUIStore.getState().showNotification(
                                            t('notification.tabLockedDuringLoad', useSettingsStore.getState().language),
                                            'warning',
                                        );
                                        return;
                                    }
                                    activateTab(tab.id);
                                }}
                                isLocked={isAnyTabLoading && tab.id !== activeTabId}
                                onClose={() => handleClose(tab.id)}
                                onContextMenu={e => handleContextMenu(e, tab.id, tab.filePath)}
                                onRename={async (newTitle) => {
                                    const prevTitle = tab.title;
                                    updateTabMeta(tab.id, { title: newTitle }); // optimistic

                                    if (tab.filePath && window.electronAPI?.renameWorkspaceFile) {
                                        try {
                                            const newPath = await window.electronAPI.renameWorkspaceFile(tab.filePath, newTitle);
                                            updateTabMeta(tab.id, { filePath: newPath });

                                            const activeId = useWorkspaceTabsStore.getState().activeTabId;
                                            if (tab.id === activeId && window.electronAPI?.setWindowTitle) {
                                                const fileName = newPath.split(/[\\/]/).pop() || 'BanaNyang';
                                                window.electronAPI.setWindowTitle(`${fileName} - BanaNyang`);
                                            }
                                        } catch (err) {
                                            const message = err instanceof Error ? err.message : String(err);
                                            console.error('Workspace file rename failed:', err);
                                            updateTabMeta(tab.id, { title: prevTitle }); // 원복
                                            const language = useSettingsStore.getState().language;
                                            useUIStore.getState().showNotification(
                                                t('workspace.rename.failed', language, { error: message }),
                                                'error',
                                            );
                                        }
                                    }
                                }}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>
            <HoverEdgeAutoScroll targetRef={tabScrollRef} axis="horizontal" />
            </div>

            <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <NewTabButton
                    onClick={() => {
                        if (isAnyTabLoading) {
                            useUIStore.getState().showNotification(
                                t('notification.tabLockedDuringLoad', useSettingsStore.getState().language),
                                'warning',
                            );
                            return;
                        }
                        createTab();
                    }}
                    disabled={isAnyTabLoading}
                />
            </div>

            {contextMenu && (
                <TabContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    tabId={contextMenu.tabId}
                    filePath={contextMenu.filePath}
                    onClose={handleClose}
                    onCloseOthers={closeOtherTabs}
                    onCloseRight={closeTabsToTheRight}
                    onDismiss={() => setContextMenu(null)}
                />
            )}
        </div>
    );
};
