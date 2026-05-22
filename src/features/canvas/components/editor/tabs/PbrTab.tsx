import React from 'react';
import { PbrSourceImage } from '../types';
import { Tooltip } from '../../../../../components/Tooltip';
import { ResetIcon, UploadIcon, PlusIcon, CloseIcon } from '../../../../../components/icons';
import { Language, TranslationKey } from '../../../../../localization';
import { useEditorStore } from '../../../../../features/toolbar/useEditorStore';
import { blobManager } from '../../../../../utils/blobManager';
import { EditorImageViewer } from '../EditorImageViewer';
import { useResizableSidebar } from '../hooks/useResizableSidebar';
import { HoverEdgeAutoScroll } from '../../../../../components/HoverEdgeAutoScroll';

interface PbrTabProps {
  language: Language;
  localImageSrc?: string | null;
}

const IMAGE_TYPE_OPTIONS = [
  { value: 'front', labelKo: '정면', labelEn: 'Front' },
  { value: 'back', labelKo: '뒷면', labelEn: 'Back' },
  { value: 'albedo', labelKo: '알베도', labelEn: 'Albedo' },
  { value: 'normal', labelKo: '노말', labelEn: 'Normal' },
  { value: 'roughness', labelKo: '러프니스', labelEn: 'Roughness' },
  { value: 'metallic', labelKo: '메탈릭', labelEn: 'Metallic' },
  { value: 'height', labelKo: '하이트', labelEn: 'Height' },
  { value: 'ao', labelKo: 'AO', labelEn: 'AO' },
  { value: 'structure', labelKo: '구조', labelEn: 'Structure' },
  { value: 'reference', labelKo: '참고', labelEn: 'Reference' },
];

const DEFAULT_SLOT_TYPES = ['structure', 'front', 'back'];

const MAP_TYPES = [
  { id: 'albedo', label: 'Albedo' },
  { id: 'normal', label: 'Normal' },
  { id: 'roughness', label: 'Roughness' },
  { id: 'metallic', label: 'Metallic' },
  { id: 'height', label: 'Height' },
  { id: 'ao', label: 'AO' },
];

export const PbrTab: React.FC<PbrTabProps> = ({ language, localImageSrc }) => {
  const {
    pbrSourceImages, setPbrSourceImages,
    selectedMapIds, toggleMapSelection, toggleAllMaps,
    resetPbr,
  } = useEditorStore();

  const { sidebarWidth, handleResizeMouseDown } = useResizableSidebar();

  const sidebarScrollRef = React.useRef<HTMLDivElement>(null);
  const pbrFileInputRef1 = React.useRef<HTMLInputElement>(null);
  const pbrFileInputRef2 = React.useRef<HTMLInputElement>(null);
  const pbrFileInputRef3 = React.useRef<HTMLInputElement>(null);
  const fileRefs = [pbrFileInputRef1, pbrFileInputRef2, pbrFileInputRef3];

  const handlePbrUploadChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const blobUrl = blobManager.create(file);
      setPbrSourceImages((prev) => {
        const newImages = [...prev];
        const oldImg = newImages[index];
        if (oldImg?.src && oldImg.src.startsWith('blob:')) blobManager.release(oldImg.src);
        let type = 'albedo';
        if (index === 1) type = 'front';
        if (index === 2) type = 'back';
        newImages[index] = { file, src: blobUrl, type };
        return newImages;
      });
      e.target.value = '';
    }
  };

  const updatePbrImageType = (index: number, type: string) => {
    setPbrSourceImages((prev) => {
      const newImages = [...prev];
      if (newImages[index]) {
        newImages[index] = { ...newImages[index]!, type };
      } else {
        newImages[index] = { src: '', type };
      }
      return newImages;
    });
  };

  const handleRemoveImage = (index: number) => {
    setPbrSourceImages((prev) => {
      const newImages = [...prev];
      newImages[index] = null;
      return newImages;
    });
  };

  const getSlotType = (index: number): string =>
    pbrSourceImages[index]?.type || DEFAULT_SLOT_TYPES[index] || 'reference';

  const renderSlot = (index: number, fileInputRef: React.RefObject<HTMLInputElement>) => {
    const slotType = getSlotType(index);
    const hasImage = pbrSourceImages[index]?.src;

    return (
      <div className="bg-white/5 border border-white/10 rounded-lg p-2 flex items-center gap-2">
        <div
          className="w-12 h-12 flex-shrink-0 bg-black/30 rounded-lg flex items-center justify-center border border-dashed border-white/20 overflow-hidden relative cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          {hasImage ? (
            <>
              <img src={pbrSourceImages[index]!.src} alt={slotType} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <UploadIcon className="w-5 h-5 text-white" />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleRemoveImage(index); }}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
              >
                <CloseIcon className="w-2.5 h-2.5" />
              </button>
            </>
          ) : (
            <PlusIcon className="w-5 h-5 text-zinc-500" />
          )}
        </div>
        <select
          value={slotType}
          onChange={(e) => updatePbrImageType(index, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-md py-1.5 px-2 text-xs text-zinc-200 outline-none cursor-pointer hover:bg-black/60 transition-colors"
        >
          {IMAGE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {language === 'ko' ? opt.labelKo : opt.labelEn}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-[#0e0e0e]">
      <EditorImageViewer className="flex-1 min-w-0 h-full" localImageSrc={localImageSrc} />

      <div
        className="relative flex-shrink-0 h-full bg-zinc-900/85 backdrop-blur-sm border-l border-white/10"
        style={{ width: sidebarWidth }}
      >
        {/* 리사이즈 핸들 */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-10 group/rh"
          onMouseDown={handleResizeMouseDown}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-px rounded-full bg-white/0 group-hover/rh:bg-white/30 transition-colors duration-150" />
        </div>
      <div ref={sidebarScrollRef} className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base text-zinc-100">
          {language === 'ko' ? 'PBR 멀티뷰' : 'PBR Multi-View'}
        </h3>
        <Tooltip tip={language === 'ko' ? '초기화' : 'Reset'} position="left">
          <button
            onClick={resetPbr}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <ResetIcon className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      <p className="text-xs text-zinc-400">
        {language === 'ko' ? '멀티뷰 이미지를 업로드하여 PBR 맵을 생성합니다.' : 'Upload multi-view images to generate PBR maps.'}
      </p>

      <input type="file" ref={pbrFileInputRef1} onChange={(e) => handlePbrUploadChange(e, 0)} className="hidden" accept="image/*" />
      <input type="file" ref={pbrFileInputRef2} onChange={(e) => handlePbrUploadChange(e, 1)} className="hidden" accept="image/*" />
      <input type="file" ref={pbrFileInputRef3} onChange={(e) => handlePbrUploadChange(e, 2)} className="hidden" accept="image/*" />

      <div className="flex flex-col gap-2">
        {renderSlot(0, pbrFileInputRef1)}
        {renderSlot(1, pbrFileInputRef2)}
        {renderSlot(2, pbrFileInputRef3)}
      </div>

      <div className="border-t border-white/10 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm text-zinc-200">
            {language === 'ko' ? '맵 유형 선택' : 'Select Map Types'}
          </h4>
          <button
            onClick={toggleAllMaps}
            className="px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-white/10 rounded border border-white/10 transition-colors"
          >
            {language === 'ko' ? '전체 토글' : 'Toggle All'}
          </button>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
          {MAP_TYPES.map((map) => (
            <label key={map.id} className="flex items-center gap-3 py-1 cursor-pointer hover:bg-white/5 rounded px-2 -mx-2 transition-colors">
              <input
                type="checkbox"
                checked={selectedMapIds.includes(map.id)}
                onChange={() => toggleMapSelection(map.id)}
                className="w-4 h-4 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
              />
              <span className="text-sm text-zinc-200">{map.label}</span>
            </label>
          ))}
        </div>
      </div>

      </div>
      </div>
      <HoverEdgeAutoScroll targetRef={sidebarScrollRef} />
    </div>
  );
};

