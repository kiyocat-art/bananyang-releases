/**
 * Metadata Store
 * Separates GenerationParams from BoardImage for memory optimization
 *
 * Benefits:
 * - Reduced memory usage per BoardImage (params stored separately)
 * - Faster Undo/Redo (only references copied, not full params)
 * - Lazy loading support for params
 */

import { create } from 'zustand';
import { GenerationParams } from '../types';

interface MetadataState {
    // Map of imageId -> GenerationParams
    params: Map<string, GenerationParams>;
}

interface MetadataActions {
    // Get params for a single image
    getParams: (imageId: string) => GenerationParams | undefined;

    // Set params for a single image
    setParams: (imageId: string, params: GenerationParams) => void;

    // Delete params for a single image
    deleteParams: (imageId: string) => void;

    // Bulk operations for efficiency
    bulkSetParams: (entries: Array<[string, GenerationParams]>) => void;
    bulkDeleteParams: (imageIds: string[]) => void;

    // Check if params exist
    hasParams: (imageId: string) => boolean;

    // Get all image IDs with params
    getAllImageIds: () => string[];

    // Get params count
    getCount: () => number;

    // Clear all params (for workspace reset)
    clear: () => void;

    // Export params as plain object (for serialization)
    exportParams: () => Record<string, GenerationParams>;

    // Import params from plain object (for deserialization)
    importParams: (data: Record<string, GenerationParams>) => void;
}

export const useMetadataStore = create<MetadataState & MetadataActions>((set, get) => ({
    params: new Map(),

    getParams: (imageId) => {
        return get().params.get(imageId);
    },

    setParams: (imageId, params) => {
        set(state => {
            const newParams = new Map(state.params);
            newParams.set(imageId, params);
            return { params: newParams };
        });
    },

    deleteParams: (imageId) => {
        set(state => {
            const newParams = new Map(state.params);
            newParams.delete(imageId);
            return { params: newParams };
        });
    },

    bulkSetParams: (entries) => {
        if (entries.length === 0) return;

        set(state => {
            const newParams = new Map(state.params);
            for (const [id, params] of entries) {
                newParams.set(id, params);
            }
            return { params: newParams };
        });
    },

    bulkDeleteParams: (imageIds) => {
        if (imageIds.length === 0) return;

        set(state => {
            const newParams = new Map(state.params);
            for (const id of imageIds) {
                newParams.delete(id);
            }
            return { params: newParams };
        });
    },

    hasParams: (imageId) => {
        return get().params.has(imageId);
    },

    getAllImageIds: () => {
        return Array.from(get().params.keys());
    },

    getCount: () => {
        return get().params.size;
    },

    clear: () => {
        set({ params: new Map() });
    },

    exportParams: () => {
        const result: Record<string, GenerationParams> = {};
        get().params.forEach((params, id) => {
            result[id] = params;
        });
        return result;
    },

    importParams: (data) => {
        const newParams = new Map<string, GenerationParams>();
        for (const [id, params] of Object.entries(data)) {
            newParams.set(id, params);
        }
        set({ params: newParams });
    },
}));

// Expose for debugging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    (window as any).metadataStore = useMetadataStore;
}

export default useMetadataStore;
