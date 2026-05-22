import { zipSync, unzipSync, strFromU8, strToU8 } from 'fflate';
import type { Zippable } from 'fflate';

const ZIP_MAGIC_0 = 0x50; // 'P'
const ZIP_MAGIC_1 = 0x4B; // 'K'
const ZIP_MAGIC_2 = 0x03;
const ZIP_MAGIC_3 = 0x04;

export function isZipContainer(bytes: Uint8Array): boolean {
    return (
        bytes.length >= 4 &&
        bytes[0] === ZIP_MAGIC_0 &&
        bytes[1] === ZIP_MAGIC_1 &&
        bytes[2] === ZIP_MAGIC_2 &&
        bytes[3] === ZIP_MAGIC_3
    );
}

export interface PackOptions {
    workspaceJson: string;
    thumbnailPng?: Uint8Array;
}

export function packWorkspaceZip({ workspaceJson, thumbnailPng }: PackOptions): Uint8Array {
    const files: Zippable = {};
    // thumbnail FIRST — streaming consumers (Shell Extension) can extract it quickly
    if (thumbnailPng && thumbnailPng.length > 0) {
        files['thumbnail.png'] = [thumbnailPng, { level: 0 }]; // PNG is already compressed
    }
    files['workspace.json'] = [strToU8(workspaceJson), { level: 6 }];
    return zipSync(files);
}

export interface UnpackResult {
    json: string;
    thumbnail: Uint8Array | null;
    isLegacy: boolean;
}

export function readWorkspacePayload(bytes: Uint8Array): UnpackResult {
    if (isZipContainer(bytes)) {
        const entries = unzipSync(bytes, {
            filter: (file) => file.name === 'workspace.json' || file.name === 'thumbnail.png',
        });
        const jsonBytes = entries['workspace.json'];
        if (!jsonBytes) {
            throw new Error('Invalid .nyang container: missing workspace.json');
        }
        return {
            json: strFromU8(jsonBytes),
            thumbnail: entries['thumbnail.png'] ?? null,
            isLegacy: false,
        };
    }
    // Legacy: raw UTF-8 JSON text
    return { json: strFromU8(bytes), thumbnail: null, isLegacy: true };
}

export function pngBase64ToUint8(b64: string): Uint8Array {
    const stripped = b64.replace(/^data:image\/\w+;base64,/, '');
    const bin = atob(stripped);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
    }
    return out;
}
