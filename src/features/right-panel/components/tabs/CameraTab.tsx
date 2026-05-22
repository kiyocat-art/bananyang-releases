import React from 'react';
import { t, Language, TranslationKey } from '../../../../localization';
import { Section } from '../../../../components/Section';
import { CameraIcon } from '../../../../components/icons';
import { Tooltip } from '../../../../components/Tooltip';
import { useGenerationStore } from '../../../../store/generationStore';
import { CameraViewSelector } from '../CameraViewSelector';
import { ViewportControl } from '../ViewportControl';
import { CameraAnglePreset, LensFocusPreset, ShotSizePreset, CameraSize } from '../../../../types';
import { CAMERA_ANGLE_PRESETS, LENS_FOCUS_PRESETS, SHOT_SIZE_PRESETS, getLensTypeFromFocalLength } from '../../../../constants';
import { CameraAngleIcons, LensFocusIcons, ShotSizeIcons } from '../CameraPresetIcons';
import { isPitchOverlapPreset } from '../../../../services/cameraPromptHelper';

const ANGLE_PRESET_VIEW: Record<CameraAnglePreset, { yaw: number; pitch: number }> = {
  eyeLevel:    { yaw: 0, pitch: 0  },
  highAngle:    { yaw: 0, pitch: -45 },
  lowAngle:    { yaw: 0, pitch: 45 },
  birdsEye:    { yaw: 0, pitch: -90 },
  wormsEye:    { yaw: 0, pitch: 90 },
  dutchAngle:   { yaw: 0, pitch: 0  },
  overTheShoulder: { yaw: 30, pitch: -10 },
};

const LENS_PRESET_FOCAL_LENGTH: Record<LensFocusPreset, number> = {
  deepFocus:   50,
  shallowFocus: 85,
  rackFocus:   85,
  fisheyeLens:  14,
  telephotoLens: 135,
  wideAngleLens: 18,
};

const SHOT_SIZE_FOV: Record<ShotSizePreset, number> = {
  extremeLongShot: 90,
  longShot:    75,
  fullShot:    65,
  kneeShot:    55,
  waistShot:    45,
  bustShot:    35,
  closeUp:     25,
  extremeCloseUp: 20,
};

// Reset Icon Component
const ResetIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className || 'w-4 h-4'}>
    <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.312.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-11.23-3.424a.75.75 0 01.451-.961 5.5 5.5 0 019.201-2.466l.311.311H11.61a.75.75 0 000 1.5h4.243a.75.75 0 00.75-.75V1.39a.75.75 0 00-1.5 0v2.43l-.31-.312A7 7 0 003.078 6.648a.75.75 0 00.961.451z" clipRule="evenodd" />
  </svg>
);

// Reset Button Component
const ResetButton: React.FC<{ onClick: () => void; tooltip: string }> = ({ onClick, tooltip }) => (
  <Tooltip tip={tooltip} position="left">
    <button
      onClick={onClick}
      className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/10 transition-all"
    >
      <ResetIcon />
    </button>
  </Tooltip>
);

interface CameraTabProps {
  language: Language;
}

// Pictogram Button Component
const PictogramButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  isSelected: boolean;
  onClick: () => void;
}> = ({ icon, label, tooltip, isSelected, onClick }) => (
  <Tooltip tip={tooltip} position="top">
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-all duration-200 cursor-pointer w-full ${isSelected
        ? 'bg-key text-zinc-900 shadow-[0_0_10px_var(--key-glow)]'
        : 'bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300'
      }`}
    >
      <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
      <span className="text-xs leading-tight text-center">{label}</span>
    </button>
  </Tooltip>
);

export const CameraTab: React.FC<CameraTabProps> = ({ language }) => {
  const {
    cameraView, setCameraView,
    isCameraViewActive, setIsCameraViewActive,
    useAposeForViews, setUseAposeForViews
  } = useGenerationStore();

  const handleSetCameraView = (view: { yaw: number; pitch: number }) => {
    setCameraView(prev => ({
      ...prev,
      yaw: view.yaw,
      pitch: view.pitch,
      // pitch-overlap presets (birdsEye/wormsEye/high/low/eyeLevel) conflict with 8-view yaw/pitch — clear them
      // Dutch/OTS are orthogonal dimensions and are preserved
      cameraAnglePreset: isPitchOverlapPreset(prev.cameraAnglePreset) ? null : prev.cameraAnglePreset,
    }));
    if (!isCameraViewActive) {
      setIsCameraViewActive(true);
    }
  };

  const handleFovChange = (fov: number) => {
    // fov and shotSizePreset are the same dimension — clear preset when slider is touched
    setCameraView(prev => ({ ...prev, fov, shotSizePreset: null }));
    if (!isCameraViewActive) setIsCameraViewActive(true);
  };

  const handleFocalLengthChange = (focalLength: number) => {
    // focalLength and lensFocusPreset are the same dimension — clear preset when slider is touched
    setCameraView(prev => ({ ...prev, focalLength, lensFocusPreset: null }));
    if (!isCameraViewActive) setIsCameraViewActive(true);
  };

  const handleAnglePresetClick = (preset: CameraAnglePreset) => {
    if (cameraView.cameraAnglePreset === preset) {
      setCameraView(prev => ({ ...prev, cameraAnglePreset: null }));
    } else if (isPitchOverlapPreset(preset)) {
      // pitch-overlap preset: sync yaw/pitch to preset values
      const view = ANGLE_PRESET_VIEW[preset];
      setCameraView(prev => ({ ...prev, cameraAnglePreset: preset, yaw: view.yaw, pitch: view.pitch }));
    } else {
      // Dutch/OTS: preserve existing yaw/pitch — these are orthogonal dimensions
      setCameraView(prev => ({ ...prev, cameraAnglePreset: preset }));
    }
    if (!isCameraViewActive) setIsCameraViewActive(true);
  };

  const handleLensFocusPresetClick = (preset: LensFocusPreset) => {
    if (cameraView.lensFocusPreset === preset) {
      setCameraView(prev => ({ ...prev, lensFocusPreset: null }));
    } else {
      setCameraView(prev => ({ ...prev, lensFocusPreset: preset, focalLength: LENS_PRESET_FOCAL_LENGTH[preset] }));
    }
    if (!isCameraViewActive) setIsCameraViewActive(true);
  };

  const handleShotSizePresetClick = (preset: ShotSizePreset) => {
    if (cameraView.shotSizePreset === preset) {
      setCameraView(prev => ({ ...prev, shotSizePreset: null }));
    } else {
      setCameraView(prev => ({ ...prev, shotSizePreset: preset, fov: SHOT_SIZE_FOV[preset] }));
    }
    if (!isCameraViewActive) setIsCameraViewActive(true);
  };

  // Reset camera control (yaw, pitch, fov, focalLength)
  const handleResetCameraControl = () => {
    setCameraView(prev => ({
      ...prev,
      yaw: 0,
      pitch: 0,
      fov: 50,
      focalLength: 50
    }));
    setIsCameraViewActive(false);
  };

  // Reset camera angle preset
  const handleResetCameraAngle = () => {
    setCameraView(prev => ({
      ...prev,
      cameraAnglePreset: null
    }));
  };

  // Reset lens/focus preset
  const handleResetLensFocus = () => {
    setCameraView(prev => ({
      ...prev,
      lensFocusPreset: null
    }));
  };

  // Reset shot size preset
  const handleResetShotSize = () => {
    setCameraView(prev => ({
      ...prev,
      shotSizePreset: null
    }));
  };

  const lensType = getLensTypeFromFocalLength(cameraView.focalLength);

  return (
    <div className="space-y-2 animate-category-fade-in">
      <Section
        title={t('section.cameraControl.title', language)}
        tooltipText={t('tooltip.section.cameraView', language)}
        icon={<CameraIcon />}
        topRightAction={
          <div className="flex items-center gap-2">
            {/* A-Pose Checkbox */}
            <Tooltip tip={t('tooltip.aPoseDescription', language)} position="left">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useAposeForViews}
                  onChange={(e) => setUseAposeForViews(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-xs text-zinc-400">A-Pose</span>
              </label>
            </Tooltip>
            <ResetButton onClick={handleResetCameraControl} tooltip={t('common.reset', language)} />
          </div>
        }
      >
        <div className="flex flex-col gap-2 w-full">
          {/* 상단: 기즈모 + 뷰 선택기 (적응형 - flex-wrap으로 자동 배치) */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* 3D Viewport Control */}
            <div className="flex justify-center items-center p-2 border rounded-lg border-white/10 bg-black/20">
              <ViewportControl
                value={cameraView}
                onChange={handleSetCameraView}
                language={language}
                isActive={isCameraViewActive}
                onActivate={() => setIsCameraViewActive(true)}
                onDeactivate={() => setIsCameraViewActive(false)}
                tooltipText={t('tooltip.viewportControl', language)}
              />
            </div>

            {/* Camera View Selector Grid */}
            <div className="flex justify-center items-center">
              <CameraViewSelector
                currentView={cameraView}
                onSetView={handleSetCameraView}
                language={language}
                isCameraViewActive={isCameraViewActive}
              />
            </div>
          </div>

          {/* FOV Slider - stronger glow */}
          <div className="w-full space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-sm text-zinc-300">{t('camera.fov' as TranslationKey, language)}</label>
              <span
                className={`text-sm font-mono transition-all duration-200 ${isCameraViewActive ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-zinc-400'}`}
              >
                {cameraView.fov}°
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="120"
              value={cameraView.fov}
              onChange={(e) => handleFovChange(Number(e.target.value))}
              className="w-full accent-zinc-300"
            />
          </div>

          {/* Focal Length Slider - stronger glow */}
          <div className="w-full space-y-1">
            <div className="flex justify-between items-center">
              <Tooltip tip={t('tooltip.focalLengthSlider', language)} position="top">
                <label className="text-sm text-zinc-300 cursor-help">{t('camera.focalLength' as TranslationKey, language)}</label>
              </Tooltip>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  {t(`camera.lensType.${lensType.key}` as TranslationKey, language)}
                </span>
                <span
                  className={`text-sm font-mono transition-all duration-200 ${isCameraViewActive ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-zinc-400'}`}
                >
                  {cameraView.focalLength}mm
                </span>
              </div>
            </div>
            <input
              type="range"
              min="14"
              max="200"
              value={cameraView.focalLength}
              onChange={(e) => handleFocalLengthChange(Number(e.target.value))}
              className="w-full accent-zinc-300"
            />
            <div className="flex justify-between text-xs text-zinc-600">
              <span>14mm</span>
              <span>50mm</span>
              <span>200mm</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Camera Angle Presets — 4-column pictogram grid */}
      <Section
        title={t('camera.anglePresets' as TranslationKey, language)}
        tooltipText={t('tooltip.cameraAngleSection', language)}
        topRightAction={cameraView.cameraAnglePreset && <ResetButton onClick={handleResetCameraAngle} tooltip={t('common.reset', language)} />}
      >
        <div className="grid grid-cols-4 gap-1.5">
          {CAMERA_ANGLE_PRESETS.map((preset) => (
            <PictogramButton
              key={preset.key}
              icon={CameraAngleIcons[preset.key]}
              label={t(`camera.angle.${preset.key}` as TranslationKey, language)}
              tooltip={t(`camera.angleTooltip.${preset.key}` as TranslationKey, language)}
              isSelected={cameraView.cameraAnglePreset === preset.key}
              onClick={() => handleAnglePresetClick(preset.key)}
            />
          ))}
        </div>
      </Section>

      {/* Lens & Focus Presets — 3-column pictogram grid */}
      <Section
        title={t('camera.lensFocusPresets' as TranslationKey, language)}
        tooltipText={t('tooltip.lensFocusSection', language)}
        topRightAction={cameraView.lensFocusPreset && <ResetButton onClick={handleResetLensFocus} tooltip={t('common.reset', language)} />}
      >
        <div className="grid grid-cols-3 gap-1.5">
          {LENS_FOCUS_PRESETS.map((preset) => (
            <PictogramButton
              key={preset.key}
              icon={LensFocusIcons[preset.key]}
              label={t(`camera.lensFocus.${preset.key}` as TranslationKey, language)}
              tooltip={t(`camera.lensFocusTooltip.${preset.key}` as TranslationKey, language)}
              isSelected={cameraView.lensFocusPreset === preset.key}
              onClick={() => handleLensFocusPresetClick(preset.key)}
            />
          ))}
        </div>
      </Section>

      {/* Shot Size Presets — 4-column pictogram grid (4×2) */}
      <Section
        title={t('camera.shotSizePresets' as TranslationKey, language)}
        tooltipText={t('tooltip.shotSizeSection', language)}
        topRightAction={cameraView.shotSizePreset && <ResetButton onClick={handleResetShotSize} tooltip={t('common.reset', language)} />}
      >
        <div className="grid grid-cols-4 gap-1.5">
          {SHOT_SIZE_PRESETS.map((preset) => (
            <PictogramButton
              key={preset.key}
              icon={ShotSizeIcons[preset.key]}
              label={t(`camera.shotSize.${preset.key}` as TranslationKey, language)}
              tooltip={t(`camera.shotSizeTooltip.${preset.key}` as TranslationKey, language)}
              isSelected={cameraView.shotSizePreset === preset.key}
              onClick={() => handleShotSizePresetClick(preset.key)}
            />
          ))}
        </div>
      </Section>
    </div>
  );
};
