import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Z_INDEX } from '../../constants/zIndex';

interface ToolbarTooltipProps {
    children: React.ReactNode;
    label: string;
    shortcut: string;
    side: 'left' | 'right' | 'bottom' | 'top';
    /** 호버 후 툴팁 표시까지 지연 (ms), 기본 400ms */
    delay?: number;
    /** 버튼이 비활성화된 이유 — 설정 시 label 대신 표시 */
    disabledReason?: string;
}

/**
 * 툴바 전용 툴팁 — 버튼 DOM에 직접 ref + 이벤트 주입.
 * display:contents wrapper를 쓰면 getBoundingClientRect()가 0을 반환하는 버그가 있어
 * React.cloneElement로 자식 버튼에 직접 ref와 마우스 이벤트를 추가한다.
 */
export const ToolbarTooltip: React.FC<ToolbarTooltipProps> = ({
    children,
    label,
    shortcut,
    side,
    delay = 0,
    disabledReason,
}) => {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = () => {
        timerRef.current = setTimeout(() => setVisible(true), delay);
    };

    const hide = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setVisible(false);
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!visible || !triggerRef.current || !tooltipRef.current) return;

        const wRect = triggerRef.current.getBoundingClientRect();
        const tRect = tooltipRef.current.getBoundingClientRect();

        let top: number;
        let left: number;

        if (side === 'top') {
            top = wRect.top - tRect.height - 8;
            left = wRect.left + wRect.width / 2 - tRect.width / 2;
        } else if (side === 'bottom') {
            top = wRect.bottom + 8;
            left = wRect.left + wRect.width / 2 - tRect.width / 2;
        } else if (side === 'left') {
            // 툴바 우측 → 툴팁을 오른쪽에
            top = wRect.top + wRect.height / 2 - tRect.height / 2;
            left = wRect.right + 8;
        } else {
            // 툴바 좌측 → 툴팁을 왼쪽에
            top = wRect.top + wRect.height / 2 - tRect.height / 2;
            left = wRect.left - tRect.width - 8;
        }

        setPos({
            top: Math.max(8, Math.min(top, window.innerHeight - tRect.height - 8)),
            left: Math.max(8, Math.min(left, window.innerWidth - tRect.width - 8)),
        });
    }, [visible, side]);

    const tooltipEl = visible ? (
        <div
            ref={tooltipRef}
            className="fixed pointer-events-none flex items-center gap-2
                       glass-tooltip text-white/80 text-sm rounded-md py-1.5 px-3
                       transition-opacity duration-150"
            style={{ top: pos.top, left: pos.left, zIndex: Z_INDEX.TOOLTIP }}
        >
            <span>{disabledReason ?? label}</span>
        </div>
    ) : null;

    const portal = document.getElementById('tooltip-root');

    // display:contents 래퍼 대신 자식 버튼에 직접 ref + 이벤트 주입
    // → getBoundingClientRect()가 실제 버튼 위치를 정확히 반환
    const child = React.Children.only(children) as React.ReactElement<
        React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }
    >;
    const childWithEvents = React.cloneElement(child, {
        ref: triggerRef as React.Ref<HTMLElement>,
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
            show();
            child.props.onMouseEnter?.(e);
        },
        onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
            hide();
            child.props.onMouseLeave?.(e);
        },
    });

    return (
        <>
            {childWithEvents}
            {portal && tooltipEl && ReactDOM.createPortal(tooltipEl, portal)}
        </>
    );
};
