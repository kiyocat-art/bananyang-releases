/**
 * usePromptContextMenu
 *
 * Reusable hook that adds a custom OS-clipboard-integrated context menu
 * to any prompt textarea. Renders the menu via createPortal to document.body
 * to escape any CSS transform stacking context in ancestor elements.
 */
import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ContextMenu, ContextMenuItem } from '../features/canvas/components/ContextMenu';
import { t, Language } from '../localization';

// ── Platform detection ────────────────────────────────────────────────────────

const isMac = typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac');
const MOD = isMac ? '⌘' : 'Ctrl';

// ── SVG icon helpers ──────────────────────────────────────────────────────────

const IconCut = React.createElement(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('circle', { cx: 6, cy: 6, r: 3 }),
    React.createElement('circle', { cx: 6, cy: 18, r: 3 }),
    React.createElement('path', { d: 'M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12' })
);

const IconCopy = React.createElement(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('rect', { x: 9, y: 9, width: 13, height: 13, rx: 2 }),
    React.createElement('path', { d: 'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1' })
);

const IconPaste = React.createElement(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: 'M9 2h6l1 3H8L9 2z' }),
    React.createElement('rect', { x: 4, y: 4, width: 16, height: 18, rx: 2 }),
    React.createElement('path', { d: 'M9 13h6M9 17h4' })
);

const IconPasteReplace = React.createElement(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: 'M9 2h6l1 3H8L9 2z' }),
    React.createElement('rect', { x: 4, y: 4, width: 16, height: 18, rx: 2 }),
    React.createElement('path', { d: 'M9 15l2 2 4-4' })
);

const IconSelectAll = React.createElement(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: 'M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M3 15v4a2 2 0 002 2h4M15 21h4a2 2 0 002-2v-4' }),
    React.createElement('rect', { x: 7, y: 7, width: 10, height: 10, rx: 1, strokeDasharray: '2 1.5' })
);

const IconDelete = React.createElement(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: 'M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z' }),
    React.createElement('line', { x1: 18, y1: 9, x2: 13, y2: 14 }),
    React.createElement('line', { x1: 13, y1: 9, x2: 18, y2: 14 })
);

const IconClear = React.createElement(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('polyline', { points: '3 6 5 6 21 6' }),
    React.createElement('path', { d: 'M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6' }),
    React.createElement('path', { d: 'M10 11v6M14 11v6' }),
    React.createElement('path', { d: 'M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2' })
);

// ─────────────────────────────────────────────────────────────────────────────

interface MenuTriggerState {
    x: number;
    y: number;
    selStart: number;
    selEnd: number;
}

interface UsePromptContextMenuOptions {
    value: string;
    onChange: (val: string) => void;
    language: Language;
    /** Pass an existing ref if the parent already holds one for other purposes. */
    textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

interface UsePromptContextMenuResult {
    /** Attach this ref to the <textarea> element. */
    ref: React.RefObject<HTMLTextAreaElement>;
    /** Attach this handler to onContextMenu of the <textarea>. */
    handleContextMenu: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
    /** Render this in the component's JSX to display the portal menu. */
    contextMenuPortal: React.ReactPortal | null;
}

export function usePromptContextMenu({
    value,
    onChange,
    language,
    textareaRef: externalRef,
}: UsePromptContextMenuOptions): UsePromptContextMenuResult {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const ref = (externalRef ?? internalRef) as React.RefObject<HTMLTextAreaElement>;
    const [menuTrigger, setMenuTrigger] = useState<MenuTriggerState | null>(null);

    // Pass raw clientX/clientY — ContextMenu.tsx handles viewport clamping
    // after measuring actual rendered size via getBoundingClientRect().
    const handleContextMenu = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const ta = ref.current;
        const selStart = ta?.selectionStart ?? 0;
        const selEnd   = ta?.selectionEnd   ?? 0;
        setMenuTrigger({ x: e.clientX, y: e.clientY, selStart, selEnd });
    }, [ref]);

    const buildMenuItems = useCallback((): ContextMenuItem[] => {
        if (!menuTrigger) return [];
        const ta = ref.current;
        const { selStart, selEnd } = menuTrigger;
        const hasSelection = selStart !== selEnd;
        const hasContent   = value.length > 0;

        const cut: ContextMenuItem = {
            label: t('contextMenu.prompt.cut', language),
            icon: IconCut,
            shortcut: `${MOD}+X`,
            disabled: !hasSelection,
            onClick: () => {
                if (!ta) return;
                const selected = value.substring(selStart, selEnd);
                navigator.clipboard.writeText(selected).then(() => {
                    const next = value.substring(0, selStart) + value.substring(selEnd);
                    onChange(next);
                    requestAnimationFrame(() => {
                        if (!ta) return;
                        ta.focus();
                        ta.selectionStart = ta.selectionEnd = selStart;
                    });
                }).catch(console.error);
            },
        };

        const copy: ContextMenuItem = {
            label: t('contextMenu.prompt.copy', language),
            icon: IconCopy,
            shortcut: `${MOD}+C`,
            disabled: !hasSelection,
            onClick: () => {
                const selected = value.substring(selStart, selEnd);
                navigator.clipboard.writeText(selected).catch(console.error);
            },
        };

        const copyAll: ContextMenuItem = {
            label: t('contextMenu.prompt.copyAll', language),
            icon: IconCopy,
            disabled: !hasContent,
            onClick: () => {
                navigator.clipboard.writeText(value).catch(console.error);
            },
        };

        const deleteSelected: ContextMenuItem = {
            label: t('contextMenu.prompt.delete', language),
            icon: IconDelete,
            shortcut: 'Del',
            disabled: !hasSelection,
            onClick: () => {
                if (!ta) return;
                const next = value.substring(0, selStart) + value.substring(selEnd);
                onChange(next);
                requestAnimationFrame(() => {
                    if (!ta) return;
                    ta.focus();
                    ta.selectionStart = ta.selectionEnd = selStart;
                });
            },
        };

        const paste: ContextMenuItem = {
            label: t('contextMenu.prompt.paste', language),
            icon: IconPaste,
            shortcut: `${MOD}+V`,
            onClick: () => {
                navigator.clipboard.readText().then(text => {
                    if (!text) return;
                    const next = value.substring(0, selStart) + text + value.substring(selEnd);
                    onChange(next);
                    requestAnimationFrame(() => {
                        if (!ta) return;
                        ta.focus();
                        ta.selectionStart = ta.selectionEnd = selStart + text.length;
                    });
                }).catch(console.error);
            },
        };

        const pasteReplace: ContextMenuItem = {
            label: t('contextMenu.prompt.pasteReplace', language),
            icon: IconPasteReplace,
            onClick: () => {
                navigator.clipboard.readText().then(text => {
                    if (!text) return;
                    onChange(text);
                    requestAnimationFrame(() => ta?.focus());
                }).catch(console.error);
            },
        };

        const selectAll: ContextMenuItem = {
            label: t('contextMenu.prompt.selectAll', language),
            icon: IconSelectAll,
            shortcut: `${MOD}+A`,
            disabled: !hasContent,
            onClick: () => {
                if (!ta) return;
                ta.focus();
                ta.select();
            },
        };

        const clearPrompt: ContextMenuItem = {
            label: t('contextMenu.prompt.clearPrompt', language),
            icon: IconClear,
            disabled: !hasContent,
            onClick: () => onChange(''),
        };

        return [
            { type: 'group-label', label: t('contextMenu.prompt.edit', language) },
            cut,
            copy,
            copyAll,
            deleteSelected,
            { type: 'separator' },
            paste,
            pasteReplace,
            { type: 'separator' },
            selectAll,
            { type: 'separator' },
            clearPrompt,
        ];
    }, [menuTrigger, value, language, ref, onChange]);

    const contextMenuPortal = menuTrigger
        ? createPortal(
            React.createElement(ContextMenu, {
                x: menuTrigger.x,
                y: menuTrigger.y,
                items: buildMenuItems(),
                onClose: () => setMenuTrigger(null),
            }),
            document.body
        )
        : null;

    return { ref, handleContextMenu, contextMenuPortal };
}
