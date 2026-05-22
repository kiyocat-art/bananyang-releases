import { ModelName } from '../types';

export interface ModelCapabilities {
    inpainting: boolean;
    objectInsertion: boolean;
    crop: boolean;
    camera: boolean;
    concept: boolean;
    aiEdit: boolean;
    pose: boolean;
    palette: boolean;
    relight: boolean;
    aiEditInsertObject: boolean;
    aiEditExpand: boolean;
    aiEditPbr: boolean;
}

const FULL: ModelCapabilities = {
    inpainting: true,
    objectInsertion: true,
    crop: true,
    camera: true,
    concept: true,
    aiEdit: true,
    pose: true,
    palette: true,
    relight: true,
    aiEditInsertObject: true,
    aiEditExpand: true,
    aiEditPbr: true,
};

export function getModelCapabilities(_modelName: ModelName): ModelCapabilities {
    return FULL;
}
