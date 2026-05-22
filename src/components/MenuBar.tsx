import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Z_INDEX } from '../constants/zIndex';

// ─── Types ───────────────────────────────────────────────────

export interface MenuItemDef {
    label?: string;
    onClick?: () => void;
    shortcut?: string;
    disabled?: boolean;
    checked?: boolean;          // for toggle items like "Always on top"
    icon?: React.ReactNode;     // icon rendering
    children?: MenuItemDef[];   // submenu
    type?: 'separator' | 'group-label';
}

export interface MenuDef {
    label: string;
    items: MenuItemDef[];
}

export interface MenuBarProps {
    menus: MenuDef[];
}

// ─── Component ───────────────────────────────────────────────

export const MenuBar: React.FC<MenuBarProps> = ({ menus }) => {
    const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
    const menuBarRef = useRef<HTMLDivElement>(null);

    const isAnyOpen = openMenuIndex !== null;

    // Close menus when clicking outside
    useEffect(() => {
        if (!isAnyOpen) return;
        const handleOutsideClick = (e: MouseEvent) => {
            if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
                setOpenMenuIndex(null);
            }
        };
        // Use capture to catch clicks before canvas handlers
        document.addEventListener('mousedown', handleOutsideClick, true);
        return () => document.removeEventListener('mousedown', handleOutsideClick, true);
    }, [isAnyOpen]);

    // Close on Escape
    useEffect(() => {
        if (!isAnyOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpenMenuIndex(null);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isAnyOpen]);

    const handleMenuClick = useCallback((index: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuIndex(prev => prev === index ? null : index);
    }, []);

    const handleMenuEnter = useCallback((index: number) => {
        if (isAnyOpen) {
            setOpenMenuIndex(index);
        }
    }, [isAnyOpen]);

    return (
        <div
            ref={menuBarRef}
            className="flex items-center h-full"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            onMouseDown={(e) => {
                // CRITICAL: Prevent canvas from losing selection
                e.preventDefault();
                e.stopPropagation();
            }}
        >
            {menus.map((menu, index) => (
                <div key={index} className="relative">
                    {/* Top-level menu button */}
                    <button
                        onMouseDown={(e) => handleMenuClick(index, e)}
                        onMouseEnter={() => handleMenuEnter(index)}
                        className={`
                            relative px-3 py-1 text-sm font-medium transition-all duration-150
                            ${openMenuIndex === index
                                ? 'text-white bg-white/15'
                                : 'text-white/70 hover:text-white hover:bg-white/5'
                            }
                        `}
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    >
                        {menu.label}
                        {/* Fluorescent glow indicator - bottom line */}
                        {openMenuIndex === index && (
                            <div
                                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full"
                                style={{
                                    width: '80%',
                                    background: 'rgba(255, 255, 255, 0.9)',
                                    boxShadow: '0 0 8px rgba(255, 255, 255, 0.8), 0 0 16px rgba(255, 255, 255, 0.4)',
                                }}
                            />
                        )}
                    </button>

                    {/* Dropdown */}
                    {openMenuIndex === index && (
                        <DropdownMenu
                            items={menu.items}
                            onClose={() => setOpenMenuIndex(null)}
                        />
                    )}
                </div>
            ))}
        </div>
    );
};

// ─── Dropdown Menu ───────────────────────────────────────────

interface DropdownMenuProps {
    items: MenuItemDef[];
    onClose: () => void;
    isSubmenu?: boolean;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ items, onClose, isSubmenu }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [submenuDirection, setSubmenuDirection] = useState<'right' | 'left'>('right');
    const menuRef = useRef<HTMLDivElement>(null);

    // Auto-detect if submenu should open left or right based on viewport
    useEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            if (rect.right + 160 > window.innerWidth) {
                setSubmenuDirection('left');
            }
        }
    }, []);

    return (
        <div
            ref={menuRef}
            className={`
                absolute py-1 whitespace-nowrap
                glass-menu rounded-lg
                animate-in fade-in zoom-in-95 duration-100
                ${isSubmenu ? 'top-0' : 'top-full mt-1 left-0'}
            `}
            style={isSubmenu ? (submenuDirection === 'right' ? { left: '100%', zIndex: Z_INDEX.HEADER_DROPDOWN } : { right: '100%', zIndex: Z_INDEX.HEADER_DROPDOWN }) : { zIndex: Z_INDEX.HEADER_DROPDOWN }}
            onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
        >
            {items.map((item, index) => {
                if (item.type === 'separator') {
                    return <div key={index} className="my-1 mx-3 border-t border-white/10" />;
                }

                if (item.type === 'group-label') {
                    return (
                        <div key={index} className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 select-none">
                            {item.icon && (
                                <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-white/80">
                                    {item.icon}
                                </span>
                            )}
                            <span className="text-sm font-bold text-white/80 whitespace-nowrap uppercase tracking-wide">
                                {item.label}
                            </span>
                            <div className="flex-1 h-px bg-white/25" />
                        </div>
                    );
                }

                const hasChildren = item.children && item.children.length > 0;
                const isDisabled = item.disabled;
                const isHovered = hoveredIndex === index;

                return (
                    <div
                        key={index}
                        className="relative"
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isDisabled || hasChildren) return;
                                item.onClick?.();
                                onClose();
                            }}
                            disabled={isDisabled}
                            className={`
                                w-full text-left flex items-center justify-between px-3 py-1.5 text-sm whitespace-nowrap
                                transition-colors duration-75
                                ${isDisabled
                                    ? 'text-white/20 cursor-default'
                                    : isHovered
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/80 hover:bg-white/10'
                                }
                            `}
                        >
                            <span className="flex items-center gap-2">
                                {item.icon && (
                                    <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0 opacity-60">
                                        {item.icon}
                                    </span>
                                )}
                                <span>{item.label}</span>
                            </span>
                            <span className="flex items-center gap-2">
                                {item.shortcut && (
                                    <span className="text-xs text-white/30 ml-4 font-mono">
                                        {item.shortcut}
                                    </span>
                                )}
                                {item.checked !== undefined && (
                                    <span className="w-4 text-center font-bold">
                                        {item.checked ? '✓' : ''}
                                    </span>
                                )}
                                {hasChildren && (
                                    <span className="text-white/30 text-xs ml-2">▸</span>
                                )}
                            </span>
                        </button>

                        {/* Submenu */}
                        {hasChildren && isHovered && (
                            <DropdownMenu
                                items={item.children!}
                                onClose={onClose}
                                isSubmenu
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
};
