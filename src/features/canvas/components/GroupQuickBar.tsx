import React from 'react';
import { useCanvasStore } from '../../../store/canvasStore';
import { Language, t } from '../../../localization';
import { Tooltip } from '../../../components/Tooltip';
import { BoardGroup } from '../../../types';

interface GroupQuickBarProps {
    language: Language;
    mainPanelRef: React.RefObject<HTMLElement>;
}

export const GroupQuickBar: React.FC<GroupQuickBarProps> = ({ mainPanelRef }) => {
    const { boardGroups, selectedGroupIds, zoomToGroup, setSelectedGroupIds } = useCanvasStore();

    if (boardGroups.length === 0) {
        return null;
    }

    const handleGroupClick = (group: BoardGroup) => {
        if (mainPanelRef.current) {
            zoomToGroup(group, mainPanelRef.current.getBoundingClientRect());
            setSelectedGroupIds(() => new Set([group.id]));
        }
    };

    return (
        <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 glass-panel p-2 rounded-xl"
            style={{
                // [PERF] GPU layer isolation to prevent flickering during canvas operations
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                contain: 'layout style paint',
                isolation: 'isolate',
            }}
        >
            {boardGroups.map(group => (
                <Tooltip key={group.id} tip={t('tooltip.goToGroup', 'ko')} position="top">
                    <button
                        onClick={() => handleGroupClick(group)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${selectedGroupIds.has(group.id) ? 'bg-white text-black' : 'bg-white/5 text-white hover:bg-white/10'}`}
                    >
                        {group.name}
                    </button>
                </Tooltip>
            ))}
        </div>
    );
};
