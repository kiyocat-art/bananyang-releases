/**
 * Image Limit Warning Component
 * Displays warnings when approaching or reaching image count limits
 * Positioned at top-center, integrated with notification area
 * 
 * 3-level warning system (PDCA Phase 2):
 * - soft (700-899): Yellow, shows every 5 images
 * - strong (900-999): Orange, shows every image add
 * - hard (1000+): Red, cannot dismiss
 */

import React, { useState, useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useSettingsStore, ImageWarningLevel } from '../store/settingsStore';
import { useMemoryCleanup, CleanupResult } from '../hooks/useMemoryCleanup';

interface ImageLimitWarningProps {
    className?: string;
    onCleanup?: () => void;
}

export const ImageLimitWarning: React.FC<ImageLimitWarningProps> = ({
    className = '',
    onCleanup,
}) => {
    const imageCount = useCanvasStore(state => state.boardImages.length);
    const { imageLimitConfig, getImageWarningLevel, dismissImageWarning } = useSettingsStore();
    const [isVisible, setIsVisible] = useState(false);
    const [warningLevel, setWarningLevel] = useState<ImageWarningLevel>('none');

    // Listen for hard limit reached event
    useEffect(() => {
        const handleLimitReached = (event: CustomEvent) => {
            setWarningLevel('hard');
            setIsVisible(true);
        };

        window.addEventListener('canvas-image-limit-reached', handleLimitReached as EventListener);
        return () => {
            window.removeEventListener('canvas-image-limit-reached', handleLimitReached as EventListener);
        };
    }, []);

    // Update warning level when image count changes
    // Note: imageLimitConfig intentionally excluded from deps —
    // getImageWarningLevel() internally calls set(lastShownAtCount),
    // which would change imageLimitConfig and cause an infinite render loop.
    useEffect(() => {
        const level = getImageWarningLevel(imageCount);
        setWarningLevel(level);
        setIsVisible(level !== 'none');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imageCount]);

    const handleDismiss = () => {
        dismissImageWarning(3600000); // Dismiss for 1 hour
        setIsVisible(false);
    };

    // Memory cleanup integration
    const { cleanup } = useMemoryCleanup();
    const [isCleaningUp, setIsCleaningUp] = useState(false);
    const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);

    const handleCleanup = async () => {
        setIsCleaningUp(true);
        try {
            const result = await cleanup();
            setCleanupResult(result);
            onCleanup?.();
            // Auto close after showing result
            setTimeout(() => {
                setIsVisible(false);
            }, 1500);
        } finally {
            setIsCleaningUp(false);
        }
    };

    if (!isVisible || warningLevel === 'none') {
        return null;
    }

    const isHard = warningLevel === 'hard';
    const isStrong = warningLevel === 'strong';
    const percentage = Math.round((imageCount / imageLimitConfig.hardLimit) * 100);

    // 3-level color scheme:
    // soft = yellow bg + black text (700-899)
    // strong = orange bg + white text (900-999)
    // hard = red bg + white text (1000+)
    const getBackgroundColor = () => {
        if (isHard) return 'rgba(220, 38, 38, 0.95)';     // Red
        if (isStrong) return 'rgba(249, 115, 22, 0.95)'; // Orange
        return 'rgba(234, 179, 8, 0.95)';                 // Yellow
    };

    const textColor = (isHard || isStrong) ? '#fff' : '#1c1917';
    const subTextColor = (isHard || isStrong) ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.6)';
    const messageColor = (isHard || isStrong) ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.75)';
    const barTrackColor = (isHard || isStrong) ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.12)';
    const barFillColor = (isHard || isStrong) ? '#fff' : 'rgba(0, 0, 0, 0.35)';
    const dismissBtnBg = (isHard || isStrong) ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
    const dismissBtnColor = (isHard || isStrong) ? '#fff' : '#1c1917';
    const cleanupBtnTextColor = isHard ? '#991b1b' : (isStrong ? '#c2410c' : '#92400e');
    const closeBtnColor = (isHard || isStrong) ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.4)';

    // Get appropriate icon for each level
    const getIcon = () => {
        if (isHard) return '🚫';
        if (isStrong) return '⚠️';
        return '💡';
    };

    // Get appropriate title for each level
    const getTitle = () => {
        if (isHard) {
            return imageCount > imageLimitConfig.hardLimit ? '이미지 제한 초과' : '이미지 제한 도달';
        }
        if (isStrong) return '이미지 제한 임박';
        return '이미지 제한 (권장사항)';
    };

    // Get appropriate message for each level
    const getMessage = () => {
        if (isHard) {
            return imageCount > imageLimitConfig.hardLimit ? (
                <>
                    최대 이미지 개수({imageLimitConfig.hardLimit}장)를 초과했습니다.<br />
                    안정성을 위해 일부 이미지를 삭제해주세요.
                </>
            ) : (
                <>
                    최대 이미지 개수에 도달했습니다.<br />
                    더 이상 이미지를 추가할 수 없습니다.
                </>
            );
        }
        if (isStrong) {
            return (
                <>
                    이미지 제한({imageLimitConfig.hardLimit}장)에 거의 도달했습니다.<br />
                    성능 저하를 방지하려면 일부 이미지를 정리해주세요.
                </>
            );
        }
        return (
            <>
                이미지가 많아 성능이 저하될 수 있습니다.<br />
                불필요한 이미지를 삭제하거나 메모리를 정리해주세요.
            </>
        );
    };

    return (
        <div
            className={`image-limit-warning animate-slide-down-enter ${className}`}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '14px 18px',
                backgroundColor: getBackgroundColor(),
                borderRadius: '16px',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
                maxWidth: '360px',
                minWidth: '280px',
                backdropFilter: 'blur(8px)',
                position: 'relative',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="text-3xl">
                    {getIcon()}
                </span>
                <div style={{ flex: 1 }}>
                    <div className="text-lg" style={{ fontWeight: 600, color: textColor }}>
                        {getTitle()}
                    </div>
                    <div className="text-sm" style={{ color: subTextColor, marginTop: '2px' }}>
                        {imageCount} / {imageLimitConfig.hardLimit} 이미지 ({percentage}%)
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div
                style={{
                    height: '6px',
                    backgroundColor: barTrackColor,
                    borderRadius: '3px',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        height: '100%',
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: barFillColor,
                        transition: 'width 0.3s',
                    }}
                />
            </div>

            {/* Message or Cleanup Result */}
            {cleanupResult ? (
                <div className="text-base" style={{
                    color: cleanupResult.success ? '#1c1917' : '#f87171',
                    lineHeight: 1.5,
                    fontWeight: 500,
                }}>
                    {cleanupResult.success
                        ? `✓ ${cleanupResult.cleanedUrls}개 URL 정리됨 (~${cleanupResult.freedMemoryMB}MB 해제)`
                        : '✗ 정리 실패'}
                </div>
            ) : (
                <div className="text-base" style={{ color: messageColor, lineHeight: 1.5 }}>
                    {getMessage()}
                </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                {!isHard && (
                    <button
                        onClick={handleDismiss}
                        className="text-sm"
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            backgroundColor: dismissBtnBg,
                            border: 'none',
                            borderRadius: '6px',
                            color: dismissBtnColor,
                            cursor: 'pointer',
                            fontWeight: 500,
                        }}
                    >
                        무시하기
                    </button>
                )}
                <button
                    onClick={handleCleanup}
                    disabled={isCleaningUp || !!cleanupResult}
                    className="text-sm"
                    style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        color: cleanupBtnTextColor,
                        cursor: (isCleaningUp || cleanupResult) ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        opacity: (isCleaningUp || cleanupResult) ? 0.7 : 1,
                    }}
                >
                    {isCleaningUp ? '정리 중...' : (isHard ? '이미지 삭제하기' : '메모리 정리')}
                </button>
            </div>

            {/* Close button */}
            <button
                onClick={() => setIsVisible(false)}
                className="text-2xl"
                style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: closeBtnColor,
                    cursor: 'pointer',
                    padding: '4px',
                    lineHeight: 1,
                }}
            >
                ✕
            </button>
        </div>
    );
};

export default ImageLimitWarning;
