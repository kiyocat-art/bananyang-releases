import React, { useEffect, useRef, useState } from 'react';
import { Z_INDEX } from '../../../constants/zIndex';

export type ContextMenuItem =
    | {
          label: string;
          icon?: React.ReactNode;
          shortcut?: string;
          onClick?: () => void;
          disabled?: boolean;
          children?: ContextMenuItem[];
      }
    | { type: 'separator' }
    | { type: 'group-label'; label: string; icon?: React.ReactNode };

export interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

interface SubmenuProps {
    items: ContextMenuItem[];
    onClose: () => void;
    parentRef: React.RefObject<HTMLDivElement>;
}

const Submenu: React.FC<SubmenuProps> = ({ items, onClose, parentRef }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [direction, setDirection] = useState<'right' | 'left'>('right');

    useEffect(() => {
        if (parentRef.current) {
            const rect = parentRef.current.getBoundingClientRect();
            if (rect.right + 160 > window.innerWidth) {
                setDirection('left');
            }
        }
    }, [parentRef]);

    return (
        <div
            ref={menuRef}
            className="absolute glass-menu rounded-md text-sm whitespace-nowrap top-0"
            style={{ zIndex: Z_INDEX.CANVAS_CONTEXT_MENU_SUBMENU, ...(direction === 'right' ? { left: '100%' } : { right: '100%' }) }}
        >
            <ul className="py-1">
                {items.map((item, index) => {
                    if ('type' in item && item.type === 'separator') {
                        return <li key={index} className="h-px bg-white/10 my-1" />;
                    }
                    if ('type' in item && item.type === 'group-label') {
                        return (
                            <li key={index}>
                                {index > 0 && <div className="h-px bg-white/10 mx-2 mt-1" />}
                                <div className="px-3 py-1.5 select-none">
                                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{item.label}</span>
                                </div>
                                <div className="h-px bg-white/10 mx-2 mb-1" />
                            </li>
                        );
                    }
                    // Regular item
                    const hasChildren = item.children && item.children.length > 0;
                    const isHovered = hoveredIndex === index;

                    return (
                        <li
                            key={index}
                            className="relative"
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            <button
                                onClick={() => {
                                    if (item.disabled || hasChildren) return;
                                    item.onClick?.();
                                    onClose();
                                }}
                                disabled={item.disabled}
                                className="w-full text-left px-3 py-2 text-white/80 hover:bg-key/10 hover:text-key disabled:text-white/30 disabled:bg-transparent flex items-center justify-between gap-2"
                            >
                                <span className="flex items-center gap-2">
                                    {item.icon && (
                                        <span className="text-zinc-400 w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                                            {item.icon}
                                        </span>
                                    )}
                                    <span>{item.label}</span>
                                </span>
                                {item.shortcut && !hasChildren && (
                                    <span className="text-zinc-500 text-xs font-mono ml-4">{item.shortcut}</span>
                                )}
                                {hasChildren && <span className="text-zinc-400 text-xs">▸</span>}
                            </button>
                            {hasChildren && isHovered && (
                                <Submenu items={item.children!} onClose={onClose} parentRef={menuRef} />
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [pos, setPos] = useState<{ top: number; left: number }>({ top: y, left: x });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    // Viewport clamp: shift menu left/up if it would overflow
    useEffect(() => {
        const el = menuRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const newLeft = rect.right > window.innerWidth ? x - rect.width : x;
        const newTop = rect.bottom > window.innerHeight ? y - rect.height : y;
        if (newLeft !== pos.left || newTop !== pos.top) {
            setPos({ top: Math.max(4, newTop), left: Math.max(4, newLeft) });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [x, y]);

    const style: React.CSSProperties = { top: pos.top, left: pos.left };

    return (
        <div
            ref={menuRef}
            className="fixed glass-menu rounded-lg text-sm whitespace-nowrap min-w-[260px]"
            style={{ ...style, zIndex: Z_INDEX.CANVAS_CONTEXT_MENU }}
        >
            <ul className="py-1.5">
                {items.map((item, index) => {
                    if ('type' in item && item.type === 'separator') {
                        return <li key={index} className="h-px bg-white/10 my-1 mx-2" />;
                    }
                    if ('type' in item && item.type === 'group-label') {
                        return (
                            <li key={index}>
                                {index > 0 && <div className="h-px bg-white/10 mx-2 mt-1" />}
                                <div className="px-3 py-1.5 select-none">
                                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{item.label}</span>
                                </div>
                                <div className="h-px bg-white/10 mx-2 mb-1" />
                            </li>
                        );
                    }
                    // Regular item
                    const hasChildren = item.children && item.children.length > 0;
                    const isHovered = hoveredIndex === index;

                    return (
                        <li
                            key={index}
                            className="relative"
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            <button
                                onClick={() => {
                                    if (item.disabled || hasChildren) return;
                                    item.onClick?.();
                                    onClose();
                                }}
                                disabled={item.disabled}
                                className="w-full text-left px-3 py-2 text-white/80 hover:bg-key/10 hover:text-key disabled:text-white/30 disabled:bg-transparent flex items-center justify-between gap-2"
                            >
                                <span className="flex items-center gap-2">
                                    {item.icon && (
                                        <span className="text-zinc-400 w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                                            {item.icon}
                                        </span>
                                    )}
                                    <span>{item.label}</span>
                                </span>
                                {item.shortcut && !hasChildren && (
                                    <span className="text-zinc-500 text-xs font-mono ml-4">{item.shortcut}</span>
                                )}
                                {hasChildren && <span className="text-zinc-400 text-xs">▸</span>}
                            </button>
                            {hasChildren && isHovered && (
                                <Submenu items={item.children!} onClose={onClose} parentRef={menuRef} />
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};
