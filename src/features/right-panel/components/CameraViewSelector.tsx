import React from 'react';
import { t, Language, TranslationKey } from '../../../localization';
import { Tooltip } from '../../../components/Tooltip';

const DIAGONAL_ARROWS: Record<string, string> = {
 FrontLeft: '↖', FrontRight: '↗',
 BackLeft: '↙', BackRight: '↘',
};

export const CameraViewSelector: React.FC<{
 currentView: { yaw: number, pitch: number };
 onSetView: (view: { yaw: number; pitch: number }) => void;
 language: Language;
 isCameraViewActive: boolean;
}> = ({ currentView, onSetView, language, isCameraViewActive }) => {

 // Yaw convention: describes which side of the subject is visible.
 // Click "Left" (←) -> user sees subject's LEFT side -> yaw=270.
 // Click "Right" (→) -> user sees subject's RIGHT side -> yaw=90.
 const viewPoints = [
  { name: 'FrontLeft', yaw: 315, pitch: 0 },
  { name: 'Front', yaw: 0, pitch: 0 },
  { name: 'FrontRight', yaw: 45, pitch: 0 },
  { name: 'Left', yaw: 270, pitch: 0 },
  null,
  { name: 'Right', yaw: 90, pitch: 0 },
  { name: 'BackLeft', yaw: 225, pitch: 0 },
  { name: 'Back', yaw: 180, pitch: 0 },
  { name: 'BackRight', yaw: 135, pitch: 0 },
 ];

 const isViewActive = (view: { yaw: number, pitch: number } | null) => {
  if (!view) return false;
  const currentYaw = (Math.round(currentView.yaw) % 360 + 360) % 360;
  const viewYaw = (Math.round(view.yaw) % 360 + 360) % 360;

  const yawDiff = Math.min(Math.abs(currentYaw - viewYaw), 360 - Math.abs(currentYaw - viewYaw));
  const pitchDiff = Math.abs(Math.round(currentView.pitch) - Math.round(view.pitch));

  return yawDiff < 1 && pitchDiff < 1;
 };

 return (
  <div className="flex justify-center">
   <div className="inline-block p-2 border rounded-lg border-white/10 bg-black/20">
    <div className="grid grid-cols-3 gap-2">
     {viewPoints.map((view, index) => {
      if (!view) {
       return (
        <div key={index} className="w-11 h-11 flex items-center justify-center bg-white/5 rounded-md text-zinc-600">
         <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
         </svg>
        </div>
       );
      }
      const isSelected = isCameraViewActive && isViewActive(view);
      const baseClass = 'w-11 h-11 rounded-md transition-all duration-200';
      // 80% glowing button when selected
      const activeClass = isSelected
       ? 'bg-white/80 text-zinc-800 shadow-[0_0_15px_rgba(255,255,255,0.6),0_0_30px_rgba(255,255,255,0.3)]'
       : (isCameraViewActive
        ? 'bg-white/10 hover:bg-white/20 text-zinc-300'
        : 'bg-white/5 hover:bg-white/10 text-zinc-400');

      return (
       <Tooltip key={view.name} tip={t(`cameraAngle.${view.name}` as TranslationKey, language)} position="top">
        <button
         onClick={() => onSetView({ yaw: view.yaw, pitch: view.pitch })}
         aria-label={t(`cameraAngle.${view.name}` as TranslationKey, language)}
         className={`${baseClass} ${activeClass}`}
        >
         <span className="text-xs leading-none select-none">
          {DIAGONAL_ARROWS[view.name] ?? t(`cameraViewSelector.${view.name}` as TranslationKey, language)}
         </span>
        </button>
       </Tooltip>
      );
     })}
    </div>
   </div>
  </div>
 );
};
