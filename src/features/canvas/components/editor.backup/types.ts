import { ObjectTransform } from '../TransformableObject';

export type { ObjectTransform };

export type ObjectMode = 'transform' | 'draw' | 'select';

export interface ObjectContextMenu {
    x: number;
    y: number;
    objectId: string;
}

export interface ObjectState {
    id: string;
    file?: File;
    src: string;
    transform: ObjectTransform;
    flipped?: boolean;
}

export interface ObjectMemo {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
}

export interface PbrSourceImage {
    file?: File;
    src: string;
    type: string; // 'front', 'back', 'albedo', etc.
}
