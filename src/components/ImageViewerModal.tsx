import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Z_INDEX } from '../constants/zIndex';
import { Tooltip } from './Tooltip';
import { CloseIcon, DownloadIcon } from './icons';
import { LoadingSpinner } from './LoadingSpinner';
import { t, Language } from '../localization';
import { GenerationParams } from '../types';
import { GenerationSummaryContent } from './GenerationSummaryContent';
import { useSettingsStore } from '../store/settingsStore';

interface ImageViewerModalProps {
  src: string;
  onClose: () => void;
  language: Language;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  // History image actions (optional)
  onDownload?: () => void;
  onDelete?: () => void;
  onLoadParams?: () => void;
  generationParams?: GenerationParams;
  downloadStatus?: 'downloading' | 'success' | null;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  src, onClose, language,
  onNext, onPrev, hasNext, hasPrev,
  onDownload, onDelete, onLoadParams, generationParams, downloadStatus,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isSpacebarPressed, setIsSpacebarPressed] = useState(false);
  const [didFallback, setDidFallback] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<{ startX: number, startY: number, startPan: { x: number, y: number } } | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const hasPannedRef = useRef(false);

  // [FLICK] Velocity tracking & inertia animation (same physics as main canvas)
  const panVelocityHistoryRef = useRef<Array<{x: number; y: number; t: number}>>([]);
  const flickAnimationRef = useRef<number | null>(null);

  const startFlickAnimation = useCallback((vx: number, vy: number) => {
    if (flickAnimationRef.current !== null) {
      cancelAnimationFrame(flickAnimationRef.current);
    }
    const FRICTION = 0.92;
    const MIN_VELOCITY = 0.5;
    let velocityX = vx;
    let velocityY = vy;
    const animate = () => {
      velocityX *= FRICTION;
      velocityY *= FRICTION;
      if (Math.sqrt(velocityX * velocityX + velocityY * velocityY) < MIN_VELOCITY) {
        flickAnimationRef.current = null;
        return;
      }
      setPosition(prev => ({ x: prev.x + velocityX, y: prev.y + velocityY }));
      flickAnimationRef.current = requestAnimationFrame(animate);
    };
    flickAnimationRef.current = requestAnimationFrame(animate);
  }, []);

  // Cleanup flick animation on unmount
  useEffect(() => {
    return () => {
      if (flickAnimationRef.current !== null) {
        cancelAnimationFrame(flickAnimationRef.current);
      }
    };
  }, []);

  const resetTransform = useCallback(() => {
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image || !image.naturalWidth) return;

    const containerRect = container.getBoundingClientRect();
    const imageAspectRatio = image.naturalWidth / image.naturalHeight;

    setImageSize({ width: image.naturalWidth, height: image.naturalHeight });

    // 상하좌우 여백 확보 + 85% 채움으로 답답함 해소 및 닫기 버튼 가시성 확보
    const VIEWPORT_PADDING = 96;
    const FILL_RATIO = 0.85;
    const availableWidth = Math.max(containerRect.width - VIEWPORT_PADDING * 2, 100);
    const availableHeight = Math.max(containerRect.height - VIEWPORT_PADDING * 2, 100);
    const targetWidth = availableWidth * FILL_RATIO;
    const targetHeight = availableHeight * FILL_RATIO;

    let initialWidth: number, initialHeight: number;
    if (imageAspectRatio > targetWidth / targetHeight) {
      initialWidth = Math.min(targetWidth, image.naturalWidth);
      initialHeight = initialWidth / imageAspectRatio;
    } else {
      initialHeight = Math.min(targetHeight, image.naturalHeight);
      initialWidth = initialHeight * imageAspectRatio;
    }

    const initialScale = initialWidth > 0 ? initialWidth / image.naturalWidth : 1;
    setScale(initialScale);
    setPosition({ x: (containerRect.width - initialWidth) / 2, y: (containerRect.height - initialHeight) / 2 });
  }, []);

  useEffect(() => {
    setDidFallback(false);
    const image = imageRef.current;
    const container = containerRef.current;
    if (image && container) {
      const handleLoad = () => resetTransform();
      image.addEventListener('load', handleLoad);
      if (image.complete) {
        handleLoad();
      }

      const resizeObserver = new ResizeObserver(resetTransform);
      resizeObserver.observe(container);

      return () => {
        image.removeEventListener('load', handleLoad);
        resizeObserver.unobserve(container);
      }
    }
  }, [src, resetTransform]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        setIsSpacebarPressed(true);
      } else if (e.key === 'ArrowLeft') {
        if (onPrev && hasPrev) {
          e.stopPropagation();
          onPrev();
        }
      } else if (e.key === 'ArrowRight') {
        if (onNext && hasNext) {
          e.stopPropagation();
          onNext();
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.stopPropagation();
        setIsSpacebarPressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Stop propagation for any clicks on buttons which are handled separately
    if (e.target !== containerRef.current && (e.target as HTMLElement).tagName === 'BUTTON') {
      return;
    }

    const isPanGesture = e.button === 1 || e.button === 2 || (isSpacebarPressed && e.button === 0);
    // REMOVED: isPotentialClickToClose logic
    // We now treat standard left clicks on the container (and image due to pointer-events-none)
    // as potential navigation clicks.

    if (!isPanGesture && e.button !== 0) {
      return;
    }

    // Cancel any ongoing flick animation when starting a new interaction
    if (flickAnimationRef.current !== null) {
      cancelAnimationFrame(flickAnimationRef.current);
      flickAnimationRef.current = null;
    }

    let moved = false;
    hasPannedRef.current = false;
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Sensitivity threshold for drag detection
      if (!moved && (Math.abs(moveEvent.clientX - startX) > 5 || Math.abs(moveEvent.clientY - startY) > 5)) {
        moved = true;
      }

      if (interactionRef.current) { // Panning
        const dx = moveEvent.clientX - interactionRef.current.startX;
        const dy = moveEvent.clientY - interactionRef.current.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasPannedRef.current = true;
        const newPos = { x: interactionRef.current.startPan.x + dx, y: interactionRef.current.startPan.y + dy };
        setPosition(newPos);

        // [FLICK] Record position history for velocity calculation
        const now = performance.now();
        const history = panVelocityHistoryRef.current;
        history.push({ x: newPos.x, y: newPos.y, t: now });
        if (history.length > 5) history.shift();
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      // If it was a simple click (not dragged/panned) and it was a left click
      if (!moved && e.button === 0 && !isPanGesture) {
        const windowWidth = window.innerWidth;
        if (upEvent.clientX < windowWidth / 2) {
          // Left half click -> Prev
          if (onPrev && hasPrev) onPrev();
        } else {
          // Right half click -> Next
          if (onNext && hasNext) onNext();
        }
      }

      // [FLICK] Apply inertia on pan release
      if (interactionRef.current && useSettingsStore.getState().flickPanning) {
        const history = panVelocityHistoryRef.current;
        const now = performance.now();
        const lastSample = history.length > 0 ? history[history.length - 1] : null;
        const isStale = !lastSample || (now - lastSample.t) > 80;

        if (!isStale && history.length >= 2) {
          const oldest = history[0];
          const newest = history[history.length - 1];
          const dt = newest.t - oldest.t;
          if (dt > 0) {
            let vx = ((newest.x - oldest.x) / dt) * 16.67;
            let vy = ((newest.y - oldest.y) / dt) * 16.67;
            const speed = Math.sqrt(vx * vx + vy * vy);
            const MAX_SPEED = 50;
            if (speed > MAX_SPEED) {
              const scl = MAX_SPEED / speed;
              vx *= scl;
              vy *= scl;
            }
            if (speed > 0.1) {
              startFlickAnimation(vx, vy);
            }
          }
        }
        panVelocityHistoryRef.current = [];
      }

      if (interactionRef.current) {
        interactionRef.current = null;
        containerRef.current?.classList.remove('cursor-grabbing');
      }
    };

    if (isPanGesture) {
      e.preventDefault();
      e.stopPropagation();
      panVelocityHistoryRef.current = [];
      interactionRef.current = { startX: e.clientX, startY: e.clientY, startPan: position };
      containerRef.current?.classList.add('cursor-grabbing');
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const scaleAmount = 1.4;

    setScale(currentScale => {
      const newScale = e.deltaY < 0 ? currentScale * scaleAmount : currentScale / scaleAmount;
      const clampedScale = Math.max(0.1, Math.min(10, newScale));

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setPosition(currentPosition => {
          const newPosX = mouseX - (mouseX - currentPosition.x) * (clampedScale / currentScale);
          const newPosY = mouseY - (mouseY - currentPosition.y) * (clampedScale / currentScale);
          return { x: newPosX, y: newPosY };
        });
      }
      return clampedScale;
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        container.removeEventListener('wheel', handleWheel);
      };
    }
  }, [handleWheel]);

  const cursorClass = isSpacebarPressed ? 'cursor-grab' : 'cursor-default';

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center select-none ${cursorClass}`}
      style={{ zIndex: Z_INDEX.IMAGE_VIEWER, animation: 'fadeIn 0.3s ease-out' }}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
        e.preventDefault();
        // Suppress context menu if right-click was used for panning
        if (hasPannedRef.current) {
          hasPannedRef.current = false;
        }
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <img
        key={src}
        ref={imageRef}
        src={src}
        alt="Zoomed view"
        className={`max-w-none max-h-none absolute object-contain pointer-events-none`}
        style={{
          top: 0,
          left: 0,
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: 'top left'
        }}
        onError={() => {
          if (!didFallback && imageRef.current) {
            setDidFallback(true);
            imageRef.current.src = `${src}${src.includes('?') ? '&' : '?'}_r=${Date.now()}`;
          }
        }}
      />

      {/* Navigation Buttons */}
      {hasPrev && onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full transition-all border border-white/10 hover:border-white/30"
          style={{ zIndex: Z_INDEX.IMAGE_VIEWER }}
          aria-label="Previous image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {hasNext && onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full transition-all border border-white/10 hover:border-white/30"
          style={{ zIndex: Z_INDEX.IMAGE_VIEWER }}
          aria-label="Next image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* 닫기 버튼 — 이미지 안쪽 우측 상단 모서리에 배치, 뷰포트 밖으로 나가지 않도록 클램프 */}
      <div
        className="absolute"
        style={imageSize.width > 0 ? {
          zIndex: Z_INDEX.IMAGE_VIEWER,
          top: Math.max(position.y + 16, 12),
          left: Math.min(position.x + (imageSize.width * scale) - 48, window.innerWidth - 56),
        } : {
          zIndex: Z_INDEX.IMAGE_VIEWER,
          top: 72,
          right: 16,
        }}
      >
        <Tooltip tip={t('close', language)} position="top">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-xl border border-white/20 shadow-lg"
            aria-label={t('close', language)}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </Tooltip>
      </div>
      {/* Action Buttons Bar (history images) */}
      {(onDownload || onDelete || onLoadParams) && (
        <div
          className="absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/15 rounded-2xl px-3 py-2"
          style={{ zIndex: Z_INDEX.IMAGE_VIEWER }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 프롬프트 정보 */}
          {onLoadParams && generationParams && (
            <Tooltip
              tip={<GenerationSummaryContent params={generationParams} language={language} />}
              position="top"
              className="text-left"
            >
              <button
                onClick={(e) => { e.stopPropagation(); onLoadParams(); }}
                className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl flex-shrink-0 text-white font-bold text-sm transition-colors"
                aria-label="Load generation params"
              >
                P
              </button>
            </Tooltip>
          )}

          {/* 구분선 */}
          {onLoadParams && generationParams && (onDownload || onDelete) && (
            <div className="w-px h-5 bg-white/20 mx-0.5" />
          )}

          {/* 다운로드 */}
          {onDownload && (
            <Tooltip tip={t('tooltip.downloadImage', language)} position="top">
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(); }}
                className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl flex-shrink-0 text-white transition-colors"
                aria-label="Download"
              >
                {downloadStatus === 'downloading'
                  ? <LoadingSpinner className="h-5 w-5" />
                  : <DownloadIcon className="w-5 h-5 pointer-events-none" />
                }
              </button>
            </Tooltip>
          )}

          {/* 삭제 */}
          {onDelete && (
            <Tooltip tip={t('contextMenu.delete', language)} position="top">
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-red-500/60 rounded-xl flex-shrink-0 text-white/70 hover:text-white transition-colors"
                aria-label="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </Tooltip>
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-zinc-300 text-xs px-3 py-1.5 rounded-full pointer-events-none" style={{ zIndex: Z_INDEX.IMAGE_VIEWER }}>
        휠: 확대/축소 | 스페이스바/휠/우클릭 + 드래그: 이동 | ←/→: 이미지 이동
      </div>
    </div>
  );
};
