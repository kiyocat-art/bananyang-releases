import React, { useRef } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { HoverEdgeAutoScroll } from './HoverEdgeAutoScroll';
import { Language } from '../localization/types';
import { Z_INDEX } from '../constants/zIndex';

interface MergeGroupsModalProps {
    language: Language;
}

export const MergeGroupsModal: React.FC<MergeGroupsModalProps> = ({ language }) => {
    const { selectedGroupIds, boardGroups, mergeGroups, setMergeGroupsModalOpen } = useCanvasStore();

    const selectedGroups = boardGroups.filter(g => selectedGroupIds.has(g.id));
    const scrollRef = useRef<HTMLDivElement>(null);

    const labels: Record<Language, { title: string; subtitle: string; cancel: string; images: string }> = {
        ko: { title: '그룹 병합', subtitle: '선택된 그룹 중 병합 대상이 될 그룹을 선택하세요.\n나머지 그룹의 이미지들이 이 그룹으로 이동합니다.', cancel: '취소', images: '장' },
        en: { title: 'Merge Groups', subtitle: 'Select the group to merge into.\nAll images from other selected groups will move into it.', cancel: 'Cancel', images: 'img' },
        ja: { title: 'グループを結合', subtitle: '結合先のグループを選択してください。\n他のグループの画像がこのグループに移動します。', cancel: 'キャンセル', images: '枚' },
        fr: { title: 'Fusionner les Groupes', subtitle: 'Sélectionnez le groupe cible.\nLes images des autres groupes y seront déplacées.', cancel: 'Annuler', images: 'img' },
        es: { title: 'Fusionar Grupos', subtitle: 'Selecciona el grupo destino.\nLas imágenes de otros grupos se moverán a este.', cancel: 'Cancelar', images: 'img' },
        id: { title: 'Gabungkan Grup', subtitle: 'Pilih grup tujuan penggabungan.\nGambar dari grup lain akan dipindahkan ke sini.', cancel: 'Batal', images: 'gbr' },
    };

    const l = labels[language] ?? labels.en;

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            style={{ zIndex: Z_INDEX.MODAL }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setMergeGroupsModalOpen(false); }}
        >
            <div className="glass-menu rounded-xl p-5 w-80 shadow-2xl border border-white/10">
                <h2 className="text-sm font-bold text-zinc-100 mb-1">{l.title}</h2>
                <p className="text-xs text-zinc-400 mb-4 whitespace-pre-line leading-relaxed">{l.subtitle}</p>

                <div className="relative max-h-60 mb-4">
                <div ref={scrollRef} className="h-full overflow-y-auto space-y-1.5 dark-glass-scrollbar">
                    {selectedGroups.map(group => (
                        <button
                            key={group.id}
                            onClick={() => mergeGroups(group.id)}
                            className="w-full text-left px-3 py-2.5 rounded-lg bg-white/5 hover:bg-yellow-400/20 border border-white/10 hover:border-yellow-400/40 transition-all text-sm text-zinc-200 flex items-center gap-2.5 group"
                        >
                            <span className="w-2 h-2 rounded-full bg-yellow-400/60 group-hover:bg-yellow-400 flex-shrink-0 transition-colors" />
                            <span className="truncate flex-1">{group.name}</span>
                            <span className="text-xs text-zinc-500 flex-shrink-0">{group.imageIds.length} {l.images}</span>
                        </button>
                    ))}
                </div>
                <HoverEdgeAutoScroll targetRef={scrollRef} />
                </div>

                <button
                    onClick={() => setMergeGroupsModalOpen(false)}
                    className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg hover:bg-white/5"
                >
                    {l.cancel}
                </button>
            </div>
        </div>
    );
};
