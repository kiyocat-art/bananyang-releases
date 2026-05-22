import bananyangLoadingIcon from '../assets/bananyang-loading.png';
import { Z_INDEX } from '../constants/zIndex';

interface LoadingOverlayProps {
  isLoading: boolean;
  message: string;
  progress: number;
  isReversed?: boolean; // When true, border empties instead of fills (for save animation)
  variant?: 'default' | 'glass'; // 'glass' = liquid glass blur effect
  scope?: 'fullscreen' | 'workspace'; // 'workspace' = absolute (fills positioned parent), 'fullscreen' = fixed
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message,
  progress,
  isReversed = false,
  variant = 'default',
  scope = 'fullscreen',
}) => {
  const animationClass = isLoading ? 'animate-fadeIn' : 'animate-fadeOut';

  // Path for the rounded rectangle border, starting from the middle-left for a "filling" effect.
  const path = "M 12,128 V 61 a 49,49 0 0 1 49,-49 H 195 a 49,49 0 0 1 49,49 V 195 a 49,49 0 0 1 -49,49 H 61 a 49,49 0 0 1 -49,-49 V 128 Z";
  // Perimeter of the rounded square with side 232 and corner radius 49. 4 * (232 - 2*49) + 2 * PI * 49 = 843.87...
  const pathLength = 844;

  // Normal: border fills up (0→100 means full)
  // Reversed: border empties (0→100 means empty) - starts full, progresses to empty
  const strokeDashoffset = isReversed
    ? (progress / 100) * pathLength  // Reversed: starts at 0 (full), goes to pathLength (empty)
    : pathLength - (progress / 100) * pathLength;  // Normal: starts at pathLength (empty), goes to 0 (full)

  // Glass variant: translucent dark background with blur
  const isGlass = variant === 'glass';
  const backgroundClass = isGlass
    ? 'bg-neutral-900/60 backdrop-blur-2xl backdrop-saturate-150'
    : scope === 'workspace'
      ? 'bg-neutral-900/85 backdrop-blur-sm'
      : 'bg-neutral-900';

  const positionClass = scope === 'workspace' ? 'absolute inset-0' : 'fixed inset-0';
  const zIndex = scope === 'workspace' ? Z_INDEX.CANVAS_LOADING : Z_INDEX.LOADING;

  return (
    <div
      className={`${positionClass} ${backgroundClass} flex flex-col items-center justify-center ${animationClass}`}
      style={{ zIndex, willChange: 'opacity, transform', transform: 'translate3d(0, 0, 0)', pointerEvents: 'auto' }}
    >
      <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translate3d(0, 0, 0); }
              to { opacity: 1; transform: translate3d(0, 0, 0); }
            }
            @keyframes fadeOut {
              from { opacity: 1; transform: translate3d(0, 0, 0); }
              to { opacity: 0; transform: translate3d(0, 0, 0); }
            }
            .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; will-change: opacity, transform; }
            .animate-fadeOut { animation: fadeOut 0.3s ease-out forwards; will-change: opacity, transform; }
        `}</style>
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Background Icon shape */}
          <path d={path} fill="#2B2B2B" strokeOpacity="0.2" />

          {/* BanaNyang Logo Image */}
          <image href={bananyangLoadingIcon} x="18" y="18" width="220" height="220" />

          {/* Progress Path */}
          <path
            d={path}
            stroke="#FFFFFF"
            strokeWidth="12"
            fill="none"
            strokeDasharray={pathLength}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
          />
        </svg>
      </div>
      <div className="mt-4 text-center">
        <p className="text-lg font-semibold text-zinc-200">{message}</p>
        <p className="text-sm font-mono text-zinc-400 mt-1">{`${Math.round(progress)}%`}</p>
      </div>
    </div>
  );
};
