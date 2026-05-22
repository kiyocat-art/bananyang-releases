import React, { useState, useRef, useEffect, useCallback } from 'react';
import { t, Language, TranslationKey } from '../../../localization';
import { Tooltip } from '../../../components/Tooltip';

// --- Viewport Control Optimization ---
// Snap Points Configuration
const PITCH_SNAP_POINTS = Array.from({ length: 11 }, (_, i) => -90 + i * 18); // 10 steps -> 11 points
const YAW_SNAP_POINTS = Array.from({ length: 16 }, (_, i) => i * 22.5); // 16 steps

// Helper Functions
const findClosest = (target: number, values: number[]): number => {
  return values.reduce((prev, curr) =>
    Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
  );
};

const findClosestCircular = (target: number, values: number[]): number => {
  const normalizedTarget = ((target % 360) + 360) % 360;
  const dist = (a: number, b: number) => {
    const d = Math.abs(a - b);
    return Math.min(d, 360 - d);
  };
  return values.reduce((prev, curr) => {
    return dist(normalizedTarget, curr) < dist(normalizedTarget, prev) ? curr : prev;
  });
};

// 3D Orbit Sphere Component - rotates with the viewport
const OrbitSphere3D: React.FC<{ isActive: boolean; yaw: number; pitch: number; isTransitioning: boolean }> = ({ isActive, yaw, pitch, isTransitioning }) => {
  const color = isActive ? '#d4d4d8' : '#52525b'; // zinc-300 / zinc-600
  const opacity = isActive ? 0.6 : 0.25;

  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center"
      style={{
        perspective: '800px',
        transformStyle: 'preserve-3d',
      }}
    >
      <div
        style={{
          width: '170px',
          height: '170px',
          transformStyle: 'preserve-3d',
          transform: `rotateX(${pitch}deg) rotateY(${yaw}deg)`,
          transition: isTransitioning ? 'transform 0.3s ease-out' : 'none',
          position: 'relative',
        }}
      >
        {/* Horizontal ring (equator) */}
        <div
          className="absolute"
          style={{
            width: '170px',
            height: '170px',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%) rotateX(90deg)',
            borderRadius: '50%',
            border: `1px dashed ${color}`,
            opacity,
            boxShadow: isActive ? '0 0 15px rgba(255,255,255,0.15)' : 'none',
          }}
        />

        {/* Vertical ring (front-back) */}
        <div
          className="absolute"
          style={{
            width: '170px',
            height: '170px',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: `1px dashed ${color}`,
            opacity,
            boxShadow: isActive ? '0 0 15px rgba(255,255,255,0.15)' : 'none',
          }}
        />

        {/* Vertical ring (left-right) */}
        <div
          className="absolute"
          style={{
            width: '170px',
            height: '170px',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%) rotateY(90deg)',
            borderRadius: '50%',
            border: `1px dashed ${color}`,
            opacity,
            boxShadow: isActive ? '0 0 15px rgba(255,255,255,0.15)' : 'none',
          }}
        />
      </div>

      {/* Outer static circle with stronger glow when active */}
      <div
        className="absolute rounded-full transition-all duration-300"
        style={{
          width: '180px',
          height: '180px',
          border: `1px solid ${isActive ? '#e4e4e7' : '#52525b'}`,
          opacity: isActive ? 0.7 : 0.3,
          boxShadow: isActive ? '0 0 25px rgba(255,255,255,0.25), 0 0 50px rgba(255,255,255,0.1)' : 'none',
        }}
      />
    </div>
  );
};

// Ground Line Component - Single thick glowing line representing the floor
const GroundLine: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  return (
    <div
      className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-300"
      style={{
        width: '155px',
        height: '3px',
        background: isActive
          ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)'
          : 'linear-gradient(90deg, transparent, rgba(113,113,122,0.5), transparent)',
        borderRadius: '2px',
        boxShadow: isActive
          ? '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.4), 0 0 60px rgba(255,255,255,0.2)'
          : 'none',
      }}
    />
  );
};

// --- 3D Viewport Control Component ---
export const ViewportControl: React.FC<{
  value: { yaw: number, pitch: number };
  onChange: (value: { yaw: number, pitch: number }) => void;
  language: Language;
  isActive?: boolean;
  onActivate?: () => void;
  onDeactivate?: () => void;
  cubeFaceClassName?: string;
  inactiveCubeFaceClassName?: string;
  tooltipText: string;
}> = ({ value, onChange, language, isActive = true, onActivate, onDeactivate, tooltipText }) => {
  const [rotation, setRotation] = useState({ yaw: value.yaw, pitch: value.pitch });
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const [isTransitioning, setIsTransitioning] = useState(true);

  const startClientPos = useRef({ x: 0, y: 0 });
  const startValue = useRef({ yaw: 0, pitch: 0 });

  // Use a ref to hold the latest props to avoid stale closures in event listeners
  const propsRef = useRef({ value, onChange, isActive, onActivate, onDeactivate });
  useEffect(() => {
    propsRef.current = { value, onChange, isActive, onActivate, onDeactivate };
  }, [value, onChange, isActive, onActivate, onDeactivate]);


  useEffect(() => {
    setIsTransitioning(true);
    const currentYaw = rotation.yaw;
    const targetYaw = value.yaw;
    const revolution = Math.round(currentYaw / 360);
    const candidates = [targetYaw + 360 * revolution, targetYaw + 360 * (revolution - 1), targetYaw + 360 * (revolution + 1)];
    const closestYaw = candidates.reduce((prev, curr) => (Math.abs(curr - currentYaw) < Math.abs(prev - currentYaw) ? curr : prev));

    setRotation({ yaw: closestYaw, pitch: value.pitch });

    const timer = setTimeout(() => setIsTransitioning(false), isDragging.current ? 0 : 300);
    return () => clearTimeout(timer);
  }, [value.yaw, value.pitch]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDragging.current = true;
    didDrag.current = false;
    setIsTransitioning(false);

    startClientPos.current = { x: e.clientX, y: e.clientY };
    startValue.current = { yaw: propsRef.current.value.yaw, pitch: propsRef.current.value.pitch };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current || !propsRef.current.isActive) return;

      const initialDx = moveEvent.clientX - startClientPos.current.x;
      const initialDy = moveEvent.clientY - startClientPos.current.y;
      if (!didDrag.current && (Math.abs(initialDx) > 3 || Math.abs(initialDy) > 3)) {
        didDrag.current = true;
      }

      if (!didDrag.current) return;

      const deltaX = moveEvent.clientX - startClientPos.current.x;
      const deltaY = moveEvent.clientY - startClientPos.current.y;
      const sensitivity = 0.4;

      const newYaw = startValue.current.yaw + deltaX * sensitivity;
      let newPitch = startValue.current.pitch - deltaY * sensitivity;

      newPitch = Math.max(-90, Math.min(90, newPitch));

      const snappedPitch = findClosest(newPitch, PITCH_SNAP_POINTS);
      const snappedYaw = findClosestCircular(newYaw, YAW_SNAP_POINTS);

      if (snappedYaw !== propsRef.current.value.yaw || snappedPitch !== propsRef.current.value.pitch) {
        propsRef.current.onChange({ yaw: snappedYaw, pitch: snappedPitch });
      }
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        if (!didDrag.current) {
          // Click logic
          const { isActive, onActivate, onDeactivate } = propsRef.current;
          if (isActive && onDeactivate) onDeactivate();
          else if (!isActive && onActivate) onActivate();
        }
      }

      isDragging.current = false;
      setIsTransitioning(true);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []); // Empty dependency array is crucial for this pattern

  return (
    <Tooltip tip={tooltipText} position="top">
      <div
        className={`relative p-2 ${!isActive ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} flex flex-col justify-center items-center transition-all duration-300`}
        style={{
          borderRadius: '16px',
          background: isActive ? 'radial-gradient(ellipse at bottom, rgba(255,255,255,0.08) 0%, transparent 70%)' : 'transparent',
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Gizmo Container */}
        <div className="relative w-56 h-52 flex items-center justify-center">
          {/* Ground Line - Glowing fluorescent light effect */}
          <GroundLine isActive={isActive} />

          {/* Orbit Sphere Wireframe */}
          <OrbitSphere3D isActive={isActive} yaw={rotation.yaw} pitch={rotation.pitch} isTransitioning={isTransitioning} />

          {/* 3D Cube - responds to the light from below */}
          <div className="w-20 h-20 relative z-10" style={{ perspective: '600px' }}>
            <div
              className="w-full h-full relative pointer-events-none"
              style={{
                transformStyle: 'preserve-3d',
                transform: `rotateX(${rotation.pitch}deg) rotateY(${rotation.yaw}deg)`,
                transition: isTransitioning ? 'transform 0.3s ease-out' : 'none',
              }}
            >
              {[
                { face: 'front', transform: 'rotateY(0deg) translateZ(2.5rem)' },
                { face: 'back', transform: 'rotateY(180deg) translateZ(2.5rem)' },
                { face: 'right', transform: 'rotateY(90deg) translateZ(2.5rem)' },
                { face: 'left', transform: 'rotateY(-90deg) translateZ(2.5rem)' },
                { face: 'top', transform: 'rotateX(90deg) translateZ(2.5rem)' },
                { face: 'bottom', transform: 'rotateX(-90deg) translateZ(2.5rem)' },
              ].map(({ face, transform }) => (
                <div
                  key={face}
                  className={`absolute inset-0 flex items-center justify-center select-none text-xs font-medium transition-all duration-300 ${isActive
                      ? 'bg-zinc-600/50 border border-zinc-400/40 text-zinc-100'
                      : 'bg-zinc-800/40 border border-zinc-600/30 text-zinc-400'
                    }`}
                  style={{
                    transform,
                    backfaceVisibility: 'hidden',
                    boxShadow: isActive ? '0 0 15px rgba(255,255,255,0.15), inset 0 -5px 15px rgba(255,255,255,0.05)' : 'none',
                  }}
                >
                  {t(`viewport.${face}` as TranslationKey, language)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Tooltip>
  );
};