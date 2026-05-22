/**
 * AI Image Sort Service — Pass 1 (Gemini Vision tagging) + DBSCAN clustering
 *
 * Pass 1: Each image batch is described via fixed-enum schema
 *         (style/subject/finish/purpose/palette/mood/shape). Structured enums
 *         eliminate free-text variation between calls.
 *
 * DBSCAN: Density-based clustering over axis-specific weighted Hamming distance.
 *         Axis modes: 'shape' (silhouette), 'concept' (subject+mood), 'color' (palette).
 *         Oddballs become noise and are bucketed into a single "Others" group.
 *
 * 2-pass verify: After DBSCAN, each cluster is checked for axis-consistency by
 *         Gemini. Low-coherence members are demoted to "Others".
 */
import { BoardImage } from '../types';
import { Language } from '../localization/types';
import * as api from './gemini/api';
import { GEMINI_MODELS } from './geminiService';
import * as imageUtils from './gemini/imageUtils';

/** Maximum images per batch for Pass 1 (description phase) */
const BATCH_SIZE = 20;

/** Safety upper bound for Auto mode (no explicit maxGroups) */
const AUTO_MAX_GROUPS = 12;

export type AxisMode = 'shape' | 'concept' | 'color' | 'auto';

/** Concrete axes used internally — auto runs all three and picks per-cluster. */
type BaseAxis = Exclude<AxisMode, 'auto'>;
const BASE_AXES: BaseAxis[] = ['shape', 'concept', 'color'];

/** Coherence threshold for auto-mode greedy acceptance and verify demotion. */
const AUTO_COHERENCE_THRESHOLD = 0.5;

export interface AiSortResult {
    groups: Record<string, string[]>;
}

export interface AiSortOptions {
    axis: AxisMode;
    maxGroups: number | 'auto';
    verifyClusters: boolean;
    language: Language;
    onProgress?: (percent: number, status: string) => void;
}

// Fixed enum schema — prevents free-text variation between calls
type StyleEnum = 'anime' | 'realistic_photo' | 'sketch' | 'lineart' | '3d_render' | 'painterly' | 'pixel_art' | 'other';
type SubjectEnum = 'single_character' | 'multiple_characters' | 'outfit' | 'background' | 'object' | 'pose_ref' | 'portrait' | 'other';
type FinishEnum = 'rough' | 'clean_lineart' | 'flat_color' | 'fully_colored' | 'monochrome' | 'photo';
type PurposeEnum = 'final' | 'reference' | 'variation' | 'wip';
type PaletteEnum = 'warm' | 'cool' | 'neutral' | 'dark' | 'bright' | 'monochrome';
type MoodEnum =
    | 'dark_fantasy' | 'cyberpunk' | 'scifi' | 'steampunk'
    | 'peaceful' | 'urban' | 'nature' | 'surreal'
    | 'retro' | 'minimalist' | 'other';
type ShapeEnum =
    | 'humanoid_single' | 'humanoid_group' | 'animal_creature' | 'object_item'
    | 'outfit_costume' | 'landscape_scene' | 'interior_room' | 'abstract_pattern'
    | 'text_typography' | 'pose_skeleton' | 'other';

type AxisField = 'shape' | 'subject' | 'style' | 'finish' | 'mood' | 'purpose' | 'palette';

interface ImageDescription {
    style: StyleEnum;
    subject: SubjectEnum;
    finish: FinishEnum;
    purpose: PurposeEnum;
    palette: PaletteEnum;
    mood: MoodEnum;
    shape: ShapeEnum;
}

const FALLBACK_DESCRIPTION: ImageDescription = {
    style: 'other',
    subject: 'other',
    finish: 'rough',
    purpose: 'reference',
    palette: 'neutral',
    mood: 'other',
    shape: 'other',
};

const PASS1_PROMPT = `You are a visual classifier. For each labeled image, classify it using exactly these 7 fixed enum fields.
Use ONLY the values listed below. Do NOT invent new values.

style: anime | realistic_photo | sketch | lineart | 3d_render | painterly | pixel_art | other
subject: single_character | multiple_characters | outfit | background | object | pose_ref | portrait | other
finish: rough | clean_lineart | flat_color | fully_colored | monochrome | photo
purpose: final | reference | variation | wip
palette: warm | cool | neutral | dark | bright | monochrome
mood: dark_fantasy | cyberpunk | scifi | steampunk | peaceful | urban | nature | surreal | retro | minimalist | other
shape: humanoid_single | humanoid_group | animal_creature | object_item | outfit_costume | landscape_scene | interior_room | abstract_pattern | text_typography | pose_skeleton | other

Images are labeled [img_0], [img_1], etc. in the order shown above.

Return ONLY valid JSON mapping each label to its classification:
{
  "img_0": {"style": "anime", "subject": "single_character", "finish": "fully_colored", "purpose": "final", "palette": "warm", "mood": "peaceful", "shape": "humanoid_single"},
  "img_1": {"style": "sketch", "subject": "pose_ref", "finish": "rough", "purpose": "reference", "palette": "monochrome", "mood": "minimalist", "shape": "pose_skeleton"}
}`;

// =============================================================================
// PASS 1 CACHE — session-scoped, keyed by image.id
// =============================================================================

const descriptionCache = new Map<string, ImageDescription>();

/** For testing: clear the description cache. */
export function clearAiSortCache(): void {
    descriptionCache.clear();
}

/**
 * Convert a BoardImage to base64 for Gemini.
 * Priority: tinyFile (128px) > proxyFile (1k) > file > src URL
 */
async function getImageBase64(image: BoardImage): Promise<{ data: string; mimeType: string } | null> {
    try {
        if (image.tinyFile) {
            return { data: await imageUtils.fileToBase64(image.tinyFile), mimeType: image.tinyFile.type || 'image/png' };
        }
        if (image.proxyFile) {
            return { data: await imageUtils.fileToBase64(image.proxyFile), mimeType: image.proxyFile.type || 'image/png' };
        }
        if (image.file) {
            return { data: await imageUtils.fileToBase64(image.file), mimeType: image.file.type || 'image/png' };
        }
        const srcUrl = image.tinySrc || image.proxySrc || image.src;
        if (srcUrl) {
            if (srcUrl.startsWith('data:')) {
                const match = srcUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (match) return { data: match[2], mimeType: match[1] };
            }
            const resp = await fetch(srcUrl);
            const blob = await resp.blob();
            const file = new File([blob], 'thumb.png', { type: blob.type });
            return { data: await imageUtils.fileToBase64(file), mimeType: blob.type || 'image/png' };
        }
        return null;
    } catch (e) {
        console.warn(`[aiSort] Failed to load image ${image.id}:`, e);
        return null;
    }
}

/**
 * PASS 1 — Describe a batch of images using fixed enum schema.
 * Returns a map of image ID → ImageDescription. Uses session cache to avoid
 * re-calling Gemini for images already described in the same session.
 */
async function describeImageBatch(images: BoardImage[]): Promise<Record<string, ImageDescription>> {
    const parts: any[] = [];
    const indexToId: string[] = [];
    const cached: Record<string, ImageDescription> = {};

    for (const image of images) {
        if (descriptionCache.has(image.id)) {
            cached[image.id] = descriptionCache.get(image.id)!;
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[aiSort] cache hit: ${image.id}`);
            }
            continue;
        }
        const imgData = await getImageBase64(image);
        if (imgData) {
            parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
            parts.push({ text: `[img_${indexToId.length}]` });
            indexToId.push(image.id);
        }
    }

    if (indexToId.length === 0) return cached;

    parts.push({ text: PASS1_PROMPT });

    const modelId = GEMINI_MODELS['gemini-flash'].id;
    const { response } = await api.generateContentUnified(modelId, { parts }, {
        responseMimeType: 'application/json',
        temperature: 0.2,
    });

    const responseText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let parsed: Record<string, any> | null = null;
    try {
        let jsonStr = responseText.trim();
        const codeBlock = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
        if (codeBlock) jsonStr = codeBlock[1].trim();
        parsed = JSON.parse(jsonStr);
    } catch (e) {
        console.error('[aiSort] Pass1 JSON parse failed:', e);
    }

    const result: Record<string, ImageDescription> = { ...cached };
    for (let i = 0; i < indexToId.length; i++) {
        const label = `img_${i}`;
        const id = indexToId[i];
        const raw = parsed?.[label];
        if (raw && raw.style && raw.subject && raw.finish && raw.purpose && raw.palette && raw.shape) {
            const desc: ImageDescription = {
                style: raw.style,
                subject: raw.subject,
                finish: raw.finish,
                purpose: raw.purpose,
                palette: raw.palette,
                mood: (raw.mood && typeof raw.mood === 'string') ? raw.mood as MoodEnum : 'other',
                shape: raw.shape,
            };
            result[id] = desc;
            descriptionCache.set(id, desc);
        }
    }

    return result;
}

// =============================================================================
// DBSCAN CLUSTERING PIPELINE
// =============================================================================

export interface ImageFeatureVector {
    id: string;
    subject: SubjectEnum;
    style: StyleEnum;
    finish: FinishEnum;
    purpose: PurposeEnum;
    palette: PaletteEnum;
    mood: MoodEnum;
    shape: ShapeEnum;
    subjectIdx: number;
    styleIdx: number;
    finishIdx: number;
    purposeIdx: number;
    paletteIdx: number;
    moodIdx: number;
    shapeIdx: number;
    isFallback?: boolean;
}

export interface ClusteringConfig {
    weights: Partial<Record<AxisField, number>>;
    eps: number;
    minPts: number;
    autoTune: boolean;
}

export interface ClusterResult {
    clusters: string[][];
    noise: string[];
}

export const DEFAULT_CLUSTERING_CONFIG: ClusteringConfig = {
    weights: { subject: 0.45, style: 0.25, mood: 0.20, palette: 0.10 },
    eps: 0.30,
    minPts: 2,
    autoTune: true,
};

/** Axis-specific weight profiles. Weights need not sum to 1 (distance is normalized). */
const AXIS_WEIGHTS: Record<BaseAxis, Partial<Record<AxisField, number>>> = {
    shape:   { shape: 0.80, subject: 0.10, finish: 0.10 },
    concept: { subject: 0.45, mood: 0.40, purpose: 0.10, style: 0.05 },
    color:   { palette: 0.75, finish: 0.20, style: 0.05 },
};

/** Base eps per axis (strictness). Shape/Color more strict than Concept. */
const DEFAULT_EPS_BY_AXIS: Record<BaseAxis, number> = {
    shape:   0.25,
    concept: 0.30,
    color:   0.25,
};

const K_DISTANCE_K = 4;
const DBSCAN_MATRIX_THRESHOLD = 500;

// Stable enum index tables — order is irrelevant to the algorithm (Hamming only
// checks equality), but cached indices avoid repeated string comparisons.
const SUBJECT_ORDER: SubjectEnum[] = [
    'single_character', 'multiple_characters', 'outfit', 'background',
    'object', 'pose_ref', 'portrait', 'other',
];
const STYLE_ORDER: StyleEnum[] = [
    'anime', 'realistic_photo', 'sketch', 'lineart',
    '3d_render', 'painterly', 'pixel_art', 'other',
];
const FINISH_ORDER: FinishEnum[] = [
    'rough', 'clean_lineart', 'flat_color', 'fully_colored', 'monochrome', 'photo',
];
const PURPOSE_ORDER: PurposeEnum[] = [
    'final', 'reference', 'variation', 'wip',
];
const MOOD_ORDER: MoodEnum[] = [
    'dark_fantasy', 'cyberpunk', 'scifi', 'steampunk',
    'peaceful', 'urban', 'nature', 'surreal',
    'retro', 'minimalist', 'other',
];
const PALETTE_ORDER: PaletteEnum[] = [
    'warm', 'cool', 'neutral', 'dark', 'bright', 'monochrome',
];
const SHAPE_ORDER: ShapeEnum[] = [
    'humanoid_single', 'humanoid_group', 'animal_creature', 'object_item',
    'outfit_costume', 'landscape_scene', 'interior_room', 'abstract_pattern',
    'text_typography', 'pose_skeleton', 'other',
];

const subjectIndex = new Map(SUBJECT_ORDER.map((v, i) => [v, i]));
const styleIndex = new Map(STYLE_ORDER.map((v, i) => [v, i]));
const finishIndex = new Map(FINISH_ORDER.map((v, i) => [v, i]));
const purposeIndex = new Map(PURPOSE_ORDER.map((v, i) => [v, i]));
const moodIndex = new Map(MOOD_ORDER.map((v, i) => [v, i]));
const paletteIndex = new Map(PALETTE_ORDER.map((v, i) => [v, i]));
const shapeIndex = new Map(SHAPE_ORDER.map((v, i) => [v, i]));

/**
 * Pure: Translate a Pass-1 description into a feature vector with cached indices.
 */
export function extractFeatureVector(id: string, desc: ImageDescription, isFallback = false): ImageFeatureVector {
    return {
        id,
        subject: desc.subject,
        style: desc.style,
        finish: desc.finish,
        purpose: desc.purpose,
        palette: desc.palette,
        mood: desc.mood,
        shape: desc.shape,
        subjectIdx: subjectIndex.get(desc.subject) ?? subjectIndex.get('other')!,
        styleIdx: styleIndex.get(desc.style) ?? styleIndex.get('other')!,
        finishIdx: finishIndex.get(desc.finish) ?? 0,
        purposeIdx: purposeIndex.get(desc.purpose) ?? 0,
        moodIdx: moodIndex.get(desc.mood) ?? moodIndex.get('other')!,
        paletteIdx: paletteIndex.get(desc.palette) ?? paletteIndex.get('neutral')!,
        shapeIdx: shapeIndex.get(desc.shape) ?? shapeIndex.get('other')!,
        isFallback,
    };
}

/**
 * Pure: Weighted Hamming distance over categorical axes defined by cfg.weights.
 * Distance is normalized to [0, 1] regardless of which fields are weighted.
 */
export function weightedDistance(a: ImageFeatureVector, b: ImageFeatureVector, cfg: ClusteringConfig): number {
    const fieldIndices: Record<string, [number, number]> = {
        shape:   [a.shapeIdx,   b.shapeIdx],
        subject: [a.subjectIdx, b.subjectIdx],
        style:   [a.styleIdx,   b.styleIdx],
        finish:  [a.finishIdx,  b.finishIdx],
        mood:    [a.moodIdx,    b.moodIdx],
        purpose: [a.purposeIdx, b.purposeIdx],
        palette: [a.paletteIdx, b.paletteIdx],
    };

    let total = 0;
    let diff = 0;
    for (const [field, weight] of Object.entries(cfg.weights) as [AxisField, number][]) {
        if (!weight) continue;
        const indices = fieldIndices[field];
        if (!indices) continue;
        total += weight;
        if (indices[0] !== indices[1]) diff += weight;
    }
    return total > 0 ? diff / total : 0;
}

/**
 * Pure: 1 - mean pairwise weighted distance. Higher = more coherent.
 * Returns 0 for clusters with < 2 members (no pairs).
 */
export function clusterCoherence(vectors: ImageFeatureVector[], cfg: ClusteringConfig): number {
    const n = vectors.length;
    if (n < 2) return 0;
    let sum = 0;
    let pairs = 0;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            sum += weightedDistance(vectors[i], vectors[j], cfg);
            pairs++;
        }
    }
    return pairs > 0 ? 1 - sum / pairs : 0;
}

/**
 * k-distance heuristic: for each point, take the distance to its k-th nearest
 * neighbor. Sort ascending. Find the knee via the largest second-derivative.
 * Returns a tuned eps and minPts adapted to the dataset size.
 */
export function autoTuneDbscanParams(
    vectors: ImageFeatureVector[],
    cfg: ClusteringConfig,
): { eps: number; minPts: number } {
    const N = vectors.length;
    if (N < 6) return { eps: 0.45, minPts: 2 };
    if (N > 500) return { eps: cfg.eps, minPts: 3 };

    const k = Math.min(K_DISTANCE_K, N - 1);
    const kthDistances: number[] = [];
    for (let i = 0; i < N; i++) {
        const dists: number[] = [];
        for (let j = 0; j < N; j++) {
            if (i !== j) dists.push(weightedDistance(vectors[i], vectors[j], cfg));
        }
        dists.sort((a, b) => a - b);
        kthDistances.push(dists[k - 1]);
    }
    kthDistances.sort((a, b) => a - b);

    // Knee detection via max second-derivative on the sorted curve.
    let kneeIdx = -1;
    let maxCurvature = 0;
    for (let i = 1; i < kthDistances.length - 1; i++) {
        const curvature = kthDistances[i + 1] - 2 * kthDistances[i] + kthDistances[i - 1];
        if (curvature > maxCurvature) {
            maxCurvature = curvature;
            kneeIdx = i;
        }
    }
    if (kneeIdx < 0 || maxCurvature < 0.05) {
        return { eps: cfg.eps, minPts: cfg.minPts };
    }
    const eps = Math.min(0.50, Math.max(0.15, kthDistances[kneeIdx]));
    return { eps, minPts: cfg.minPts };
}

/**
 * Pure: Standard DBSCAN over feature vectors. Border-point reclaim included.
 * Precomputes a triangular distance matrix when N is small enough to fit comfortably.
 */
export function dbscan(vectors: ImageFeatureVector[], cfg: ClusteringConfig): ClusterResult {
    const N = vectors.length;
    if (N === 0) return { clusters: [], noise: [] };

    // labels: -1 = unvisited, 0 = noise, >0 = cluster id
    const UNVISITED = -1;
    const NOISE = 0;
    const labels = new Int32Array(N).fill(UNVISITED);

    let matrix: Float32Array | null = null;
    if (N <= DBSCAN_MATRIX_THRESHOLD) {
        matrix = new Float32Array((N * (N + 1)) / 2);
        for (let i = 0; i < N; i++) {
            for (let j = i; j < N; j++) {
                matrix[triIdx(i, j, N)] = i === j ? 0 : weightedDistance(vectors[i], vectors[j], cfg);
            }
        }
    }

    const dist = (i: number, j: number): number => {
        if (matrix) {
            return i <= j ? matrix[triIdx(i, j, N)] : matrix[triIdx(j, i, N)];
        }
        return weightedDistance(vectors[i], vectors[j], cfg);
    };

    const regionQuery = (i: number): number[] => {
        const out: number[] = [];
        for (let j = 0; j < N; j++) {
            if (dist(i, j) <= cfg.eps) out.push(j);
        }
        return out;
    };

    let clusterId = 0;

    for (let i = 0; i < N; i++) {
        if (labels[i] !== UNVISITED) continue;
        const neighbors = regionQuery(i);
        if (neighbors.length < cfg.minPts) {
            labels[i] = NOISE;
            continue;
        }
        clusterId++;
        labels[i] = clusterId;

        const seeds = neighbors.filter(n => n !== i);
        while (seeds.length > 0) {
            const q = seeds.pop()!;
            if (labels[q] === NOISE) {
                labels[q] = clusterId; // border-point reclaim
                continue;
            }
            if (labels[q] !== UNVISITED) continue;
            labels[q] = clusterId;
            const qNeighbors = regionQuery(q);
            if (qNeighbors.length >= cfg.minPts) {
                for (const p of qNeighbors) {
                    if (labels[p] === UNVISITED || labels[p] === NOISE) seeds.push(p);
                }
            }
        }
    }

    const clusterMap = new Map<number, string[]>();
    const noise: string[] = [];
    for (let i = 0; i < N; i++) {
        if (labels[i] === NOISE) noise.push(vectors[i].id);
        else {
            const arr = clusterMap.get(labels[i]) ?? [];
            arr.push(vectors[i].id);
            clusterMap.set(labels[i], arr);
        }
    }
    const clusters = Array.from(clusterMap.values()).sort((a, b) => b.length - a.length);
    return { clusters, noise };
}

function triIdx(i: number, j: number, N: number): number {
    // Upper-triangular index for symmetric matrix stored flat, i <= j.
    return (i * (2 * N - i + 1)) / 2 + (j - i);
}

/**
 * Pure: Orchestrate extract → autoTune → dbscan.
 * Fallback-tagged descriptions are routed directly to noise to avoid forming a
 * spurious cluster of all-default tags.
 */
export function clusterImagesByFeatures(
    descriptions: Record<string, ImageDescription>,
    cfg: ClusteringConfig = DEFAULT_CLUSTERING_CONFIG,
    fallbackIds?: Set<string>,
    maxGroups?: number,
): ClusterResult {
    const allIds = Object.keys(descriptions);
    const fallbackNoise: string[] = [];
    const vectors: ImageFeatureVector[] = [];

    for (const id of allIds) {
        const isFallback = fallbackIds?.has(id) ?? false;
        if (isFallback) fallbackNoise.push(id);
        else vectors.push(extractFeatureVector(id, descriptions[id], false));
    }

    if (vectors.length === 0) {
        return { clusters: [], noise: fallbackNoise };
    }

    const tuned = cfg.autoTune ? autoTuneDbscanParams(vectors, cfg) : { eps: cfg.eps, minPts: cfg.minPts };
    const effective: ClusteringConfig = { ...cfg, eps: tuned.eps, minPts: tuned.minPts };

    if (maxGroups && maxGroups > 0 && vectors.length >= 6) {
        const dynamicMinPts = Math.max(3, Math.ceil(vectors.length / (maxGroups * 4)));
        effective.minPts = Math.max(effective.minPts, dynamicMinPts);
    }

    const result = dbscan(vectors, effective);

    // dbscan returns clusters sorted descending by size.
    // Keep top-K clusters as meaningful groups; demote the rest to noise.
    let finalClusters = result.clusters;
    let extraNoise: string[] = [];
    if (maxGroups && maxGroups > 0 && result.clusters.length > maxGroups) {
        finalClusters = result.clusters.slice(0, maxGroups);
        extraNoise = result.clusters.slice(maxGroups).flat();
    }

    if (process.env.NODE_ENV !== 'production') {
        console.log('[aiSort] DBSCAN', {
            N: vectors.length,
            eps: tuned.eps.toFixed(3),
            minPts: effective.minPts,
            rawClusters: result.clusters.length,
            keptClusters: finalClusters.length,
            demotedToNoise: extraNoise.length,
            noise: result.noise.length,
            fallbackNoise: fallbackNoise.length,
            maxGroups: maxGroups ?? 'unlimited',
        });
    }

    return {
        clusters: finalClusters,
        noise: [...result.noise, ...extraNoise, ...fallbackNoise],
    };
}

// =============================================================================
// 2-PASS CLUSTER VERIFICATION
// =============================================================================

const VERIFY_AXIS_LABEL: Record<BaseAxis, string> = {
    shape: 'shape (visual silhouette and compositional form)',
    concept: 'concept (thematic subject and mood/atmosphere)',
    color: 'color (color palette and tonal range)',
};

/**
 * Verify a single cluster's axis-consistency using Gemini.
 * Returns the set of image IDs that are outliers (don't fit the group).
 * Returns null on API failure (treat as no demotions).
 */
async function verifyCluster(
    clusterImages: BoardImage[],
    axis: BaseAxis,
): Promise<{ coherence: number; outlierIds: string[] } | null> {
    if (clusterImages.length < 2) return null;

    const parts: any[] = [];
    const indexToId: string[] = [];

    for (const image of clusterImages) {
        const imgData = await getImageBase64(image);
        if (imgData) {
            parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
            parts.push({ text: `[img_${indexToId.length}]` });
            indexToId.push(image.id);
        }
    }

    if (indexToId.length < 2) return null;

    const axisLabel = VERIFY_AXIS_LABEL[axis];
    const verifyPrompt = `You are a visual consistency reviewer.
These images form a candidate group. The grouping criterion is: ${axisLabel}.

Images are labeled [img_0], [img_1], etc.

Rate how consistent these images are by the criterion above.

Return ONLY valid JSON:
{
  "coherence": 0.85,
  "outliers": []
}
Where:
- "coherence": 0.0 (completely inconsistent) to 1.0 (perfectly consistent)
- "outliers": list of image labels that don't fit (e.g. ["img_2"]) — empty list if all fit`;

    parts.push({ text: verifyPrompt });

    try {
        const modelId = GEMINI_MODELS['gemini-flash'].id;
        const { response } = await api.generateContentUnified(modelId, { parts }, {
            responseMimeType: 'application/json',
            temperature: 0.1,
        });

        const responseText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let parsed: any = null;
        try {
            let jsonStr = responseText.trim();
            const codeBlock = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
            if (codeBlock) jsonStr = codeBlock[1].trim();
            parsed = JSON.parse(jsonStr);
        } catch {
            return null;
        }

        const coherence = typeof parsed?.coherence === 'number' ? Math.max(0, Math.min(1, parsed.coherence)) : 1;
        const outlierLabels: string[] = Array.isArray(parsed?.outliers) ? parsed.outliers : [];
        const outlierIds = outlierLabels
            .map((label: string) => {
                const m = label.match(/img_(\d+)/);
                return m ? indexToId[parseInt(m[1], 10)] : null;
            })
            .filter((id): id is string => id != null);

        return { coherence, outlierIds };
    } catch (e) {
        console.warn('[aiSort] verify cluster failed:', e);
        return null;
    }
}

// =============================================================================
// NAMING — purely deterministic, no LLM
// =============================================================================

type LabelDict = Partial<Record<SubjectEnum | StyleEnum | MoodEnum | ShapeEnum | PaletteEnum, string>>;

const SUBJECT_LABELS: Record<Language, LabelDict> = {
    en: {
        single_character: 'Characters', multiple_characters: 'Group Scenes', outfit: 'Outfits',
        background: 'Backgrounds', object: 'Objects', pose_ref: 'Pose References',
        portrait: 'Portraits', other: 'Miscellaneous',
    },
    ko: {
        single_character: '캐릭터', multiple_characters: '군상', outfit: '의상',
        background: '배경', object: '오브젝트', pose_ref: '포즈 레퍼런스',
        portrait: '초상', other: '기타',
    },
    ja: {
        single_character: 'キャラクター', multiple_characters: '群像', outfit: '衣装',
        background: '背景', object: 'オブジェクト', pose_ref: 'ポーズ参考',
        portrait: 'ポートレート', other: 'その他',
    },
    id: {
        single_character: 'Karakter', multiple_characters: 'Adegan Grup', outfit: 'Pakaian',
        background: 'Latar', object: 'Objek', pose_ref: 'Referensi Pose',
        portrait: 'Potret', other: 'Lainnya',
    },
    es: {
        single_character: 'Personajes', multiple_characters: 'Escenas Grupales', outfit: 'Atuendos',
        background: 'Fondos', object: 'Objetos', pose_ref: 'Referencias de Pose',
        portrait: 'Retratos', other: 'Varios',
    },
    fr: {
        single_character: 'Personnages', multiple_characters: 'Scènes de Groupe', outfit: 'Tenues',
        background: 'Arrière-plans', object: 'Objets', pose_ref: 'Références de Pose',
        portrait: 'Portraits', other: 'Divers',
    },
};

const STYLE_LABELS: Record<Language, LabelDict> = {
    en: {
        anime: 'Anime', realistic_photo: 'Realistic', sketch: 'Sketch', lineart: 'Line Art',
        '3d_render': '3D Render', painterly: 'Painterly', pixel_art: 'Pixel Art', other: '',
    },
    ko: {
        anime: '애니메', realistic_photo: '실사', sketch: '스케치', lineart: '라인아트',
        '3d_render': '3D', painterly: '회화', pixel_art: '픽셀아트', other: '',
    },
    ja: {
        anime: 'アニメ', realistic_photo: '実写', sketch: 'スケッチ', lineart: 'ラインアート',
        '3d_render': '3D', painterly: '絵画調', pixel_art: 'ピクセルアート', other: '',
    },
    id: {
        anime: 'Anime', realistic_photo: 'Realistis', sketch: 'Sketsa', lineart: 'Line Art',
        '3d_render': '3D', painterly: 'Lukisan', pixel_art: 'Pixel Art', other: '',
    },
    es: {
        anime: 'Anime', realistic_photo: 'Realista', sketch: 'Boceto', lineart: 'Línea',
        '3d_render': '3D', painterly: 'Pictórico', pixel_art: 'Pixel Art', other: '',
    },
    fr: {
        anime: 'Anime', realistic_photo: 'Réaliste', sketch: 'Croquis', lineart: 'Trait',
        '3d_render': '3D', painterly: 'Peint', pixel_art: 'Pixel Art', other: '',
    },
};

const MOOD_LABELS: Record<Language, LabelDict> = {
    en: {
        dark_fantasy: 'Dark Fantasy', cyberpunk: 'Cyberpunk', scifi: 'Sci-Fi', steampunk: 'Steampunk',
        peaceful: 'Peaceful', urban: 'Urban', nature: 'Nature', surreal: 'Surreal',
        retro: 'Retro', minimalist: 'Minimalist', other: '',
    },
    ko: {
        dark_fantasy: '다크 판타지', cyberpunk: '사이버펑크', scifi: 'SF', steampunk: '스팀펑크',
        peaceful: '평화', urban: '도시', nature: '자연', surreal: '초현실',
        retro: '레트로', minimalist: '미니멀', other: '',
    },
    ja: {
        dark_fantasy: 'ダークファンタジー', cyberpunk: 'サイバーパンク', scifi: 'SF', steampunk: 'スチームパンク',
        peaceful: '平和', urban: '都市', nature: '自然', surreal: 'シュール',
        retro: 'レトロ', minimalist: 'ミニマル', other: '',
    },
    id: {
        dark_fantasy: 'Dark Fantasy', cyberpunk: 'Cyberpunk', scifi: 'Sci-Fi', steampunk: 'Steampunk',
        peaceful: 'Damai', urban: 'Urban', nature: 'Alam', surreal: 'Surealis',
        retro: 'Retro', minimalist: 'Minimalis', other: '',
    },
    es: {
        dark_fantasy: 'Fantasía Oscura', cyberpunk: 'Cyberpunk', scifi: 'Ciencia Ficción', steampunk: 'Steampunk',
        peaceful: 'Pacífico', urban: 'Urbano', nature: 'Naturaleza', surreal: 'Surrealista',
        retro: 'Retro', minimalist: 'Minimalista', other: '',
    },
    fr: {
        dark_fantasy: 'Dark Fantasy', cyberpunk: 'Cyberpunk', scifi: 'Science-Fiction', steampunk: 'Steampunk',
        peaceful: 'Paisible', urban: 'Urbain', nature: 'Nature', surreal: 'Surréaliste',
        retro: 'Rétro', minimalist: 'Minimaliste', other: '',
    },
};

const SHAPE_LABELS: Record<Language, LabelDict> = {
    en: {
        humanoid_single: 'Solo Figure', humanoid_group: 'Group Figures',
        animal_creature: 'Animals & Creatures', object_item: 'Objects',
        outfit_costume: 'Outfits', landscape_scene: 'Landscapes',
        interior_room: 'Interior', abstract_pattern: 'Abstract',
        text_typography: 'Typography', pose_skeleton: 'Pose References',
        other: 'Miscellaneous',
    },
    ko: {
        humanoid_single: '단독 인물', humanoid_group: '다수 인물',
        animal_creature: '동물·생물', object_item: '오브젝트',
        outfit_costume: '의상', landscape_scene: '풍경',
        interior_room: '실내', abstract_pattern: '추상',
        text_typography: '타이포', pose_skeleton: '포즈 참고',
        other: '기타',
    },
    ja: {
        humanoid_single: '単体人物', humanoid_group: '群像',
        animal_creature: '動物・生物', object_item: 'オブジェクト',
        outfit_costume: '衣装', landscape_scene: '風景',
        interior_room: '室内', abstract_pattern: '抽象',
        text_typography: 'タイポ', pose_skeleton: 'ポーズ参考',
        other: 'その他',
    },
    id: {
        humanoid_single: 'Figur Solo', humanoid_group: 'Figur Grup',
        animal_creature: 'Hewan & Makhluk', object_item: 'Objek',
        outfit_costume: 'Pakaian', landscape_scene: 'Pemandangan',
        interior_room: 'Interior', abstract_pattern: 'Abstrak',
        text_typography: 'Tipografi', pose_skeleton: 'Referensi Pose',
        other: 'Lainnya',
    },
    es: {
        humanoid_single: 'Figura Solo', humanoid_group: 'Figuras Grupales',
        animal_creature: 'Animales y Criaturas', object_item: 'Objetos',
        outfit_costume: 'Atuendos', landscape_scene: 'Paisajes',
        interior_room: 'Interior', abstract_pattern: 'Abstracto',
        text_typography: 'Tipografía', pose_skeleton: 'Referencias de Pose',
        other: 'Varios',
    },
    fr: {
        humanoid_single: 'Personnage Solo', humanoid_group: 'Personnages Groupés',
        animal_creature: 'Animaux & Créatures', object_item: 'Objets',
        outfit_costume: 'Tenues', landscape_scene: 'Paysages',
        interior_room: 'Intérieur', abstract_pattern: 'Abstrait',
        text_typography: 'Typographie', pose_skeleton: 'Références de Pose',
        other: 'Divers',
    },
};

const PALETTE_LABELS: Record<Language, LabelDict> = {
    en: { warm: 'Warm Tones', cool: 'Cool Tones', neutral: 'Neutral', dark: 'Dark', bright: 'Bright', monochrome: 'Monochrome' },
    ko: { warm: '따뜻한 색감', cool: '차가운 색감', neutral: '뉴트럴', dark: '어두운', bright: '밝은', monochrome: '모노크롬' },
    ja: { warm: '暖色系', cool: '寒色系', neutral: 'ニュートラル', dark: 'ダーク', bright: 'ブライト', monochrome: 'モノクロ' },
    id: { warm: 'Nada Hangat', cool: 'Nada Sejuk', neutral: 'Netral', dark: 'Gelap', bright: 'Cerah', monochrome: 'Monokrom' },
    es: { warm: 'Tonos Cálidos', cool: 'Tonos Fríos', neutral: 'Neutral', dark: 'Oscuro', bright: 'Brillante', monochrome: 'Monocromo' },
    fr: { warm: 'Tons Chauds', cool: 'Tons Froids', neutral: 'Neutre', dark: 'Sombre', bright: 'Lumineux', monochrome: 'Monochrome' },
};

function majorityVote<T extends string>(items: T[]): T {
    const counts = new Map<T, number>();
    for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
    let best: T = items[0];
    let bestCount = 0;
    for (const [item, count] of counts) {
        if (count > bestCount) {
            best = item;
            bestCount = count;
        }
    }
    return best;
}

/**
 * Pure: Build a human-readable cluster name from majority-vote tags.
 * Naming strategy depends on the active axis.
 * Falls back to disambiguation suffixes on collision.
 */
export function nameClusterFromTags(
    members: ImageDescription[],
    language: Language,
    usedNames: Set<string>,
    axis: BaseAxis = 'concept',
): string {
    if (members.length === 0) return SUBJECT_LABELS[language].other!;

    const subject = majorityVote(members.map(m => m.subject));
    const style = majorityVote(members.map(m => m.style));
    const mood = majorityVote(members.map(m => m.mood));
    const palette = majorityVote(members.map(m => m.palette));
    const shape = majorityVote(members.map(m => m.shape));

    let primary: string;
    let secondary: string;

    if (axis === 'shape') {
        primary = SHAPE_LABELS[language][shape] ?? SHAPE_LABELS['en'][shape] ?? shape;
        const subjectLabel = SUBJECT_LABELS[language][subject] ?? '';
        secondary = subjectLabel ? `${primary} (${subjectLabel})` : `${primary} #2`;
    } else if (axis === 'color') {
        primary = PALETTE_LABELS[language][palette] ?? PALETTE_LABELS['en'][palette] ?? palette;
        const styleLabel = STYLE_LABELS[language][style] ?? '';
        secondary = styleLabel ? `${primary} (${styleLabel})` : `${primary} #2`;
    } else {
        // concept (default)
        const subjectLabel = SUBJECT_LABELS[language][subject] ?? subject;
        const styleLabel = STYLE_LABELS[language][style] ?? '';
        const moodLabel = MOOD_LABELS[language][mood] ?? '';
        primary = styleLabel ? `${styleLabel} ${subjectLabel}` : subjectLabel;
        secondary = moodLabel ? `${primary} (${moodLabel})` : `${primary} (${palette})`;
    }

    if (!usedNames.has(primary)) return primary;
    if (!usedNames.has(secondary)) return secondary;

    let i = 2;
    while (usedNames.has(`${primary} #${i}`)) i++;
    return `${primary} #${i}`;
}

// =============================================================================
// MAIN ENTRY
// =============================================================================

/**
 * Classify all ungrouped images via Pass 1 (Gemini tagging) + DBSCAN clustering.
 * Axis determines the weighting profile. 2-pass verify demotes outliers to Others.
 */
export async function classifyImages(
    images: BoardImage[],
    opts: AiSortOptions,
): Promise<AiSortResult> {
    const { axis, maxGroups, verifyClusters, language, onProgress } = opts;

    if (images.length === 0) return { groups: {} };

    // === PASS 1: Batch-wise image description ===
    const allDescriptions: Record<string, ImageDescription> = {};
    const fallbackIds = new Set<string>();

    if (images.length === 1) {
        onProgress?.(50, 'Analyzing images...');
        const single = await describeImageBatch(images);
        const desc = single[images[0].id] ?? FALLBACK_DESCRIPTION;
        const namingAxis: BaseAxis = axis === 'auto' ? 'concept' : axis;
        const name = nameClusterFromTags([desc], language, new Set(), namingAxis);
        onProgress?.(85, 'Grouping...');
        return { groups: { [name]: [images[0].id] } };
    }

    const totalBatches = Math.ceil(images.length / BATCH_SIZE);
    for (let i = 0; i < totalBatches; i++) {
        const batch = images.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const progressPct = 5 + Math.round(((i + 0.5) / totalBatches) * 60);
        onProgress?.(progressPct, 'Analyzing images...');
        const batchDesc = await describeImageBatch(batch);
        Object.assign(allDescriptions, batchDesc);
    }

    for (const img of images) {
        if (!allDescriptions[img.id]) {
            console.warn(`[aiSort] Pass1 missing description for ${img.id}, using fallback`);
            allDescriptions[img.id] = { ...FALLBACK_DESCRIPTION };
            fallbackIds.add(img.id);
        }
    }

    const imageMap = new Map(images.map(img => [img.id, img]));

    if (axis === 'auto') {
        return classifyImagesAuto(images, allDescriptions, fallbackIds, imageMap, {
            maxGroups, verifyClusters, language, onProgress,
        });
    }

    return classifyImagesSingleAxis(axis, images, allDescriptions, fallbackIds, imageMap, {
        maxGroups, verifyClusters, language, onProgress,
    });
}

interface SubClassifyOpts {
    maxGroups: number | 'auto';
    verifyClusters: boolean;
    language: Language;
    onProgress?: (percent: number, status: string) => void;
}

async function classifyImagesSingleAxis(
    axis: BaseAxis,
    images: BoardImage[],
    allDescriptions: Record<string, ImageDescription>,
    fallbackIds: Set<string>,
    imageMap: Map<string, BoardImage>,
    opts: SubClassifyOpts,
): Promise<AiSortResult> {
    const { maxGroups, verifyClusters, language, onProgress } = opts;

    // === DBSCAN clustering with axis-specific weights/eps ===
    onProgress?.(70, 'Grouping...');
    const axisCfg: ClusteringConfig = {
        ...DEFAULT_CLUSTERING_CONFIG,
        weights: AXIS_WEIGHTS[axis],
        eps: DEFAULT_EPS_BY_AXIS[axis],
    };

    const effectiveMax = maxGroups === 'auto' ? AUTO_MAX_GROUPS : maxGroups;
    const { clusters, noise } = clusterImagesByFeatures(allDescriptions, axisCfg, fallbackIds, effectiveMax);

    // === 2-PASS VERIFY ===
    let finalClusters = clusters;
    const verifyNoise: string[] = [];

    if (verifyClusters && clusters.length > 0) {
        const totalVerify = clusters.length;
        const verifyResults: string[][] = [];

        for (let ci = 0; ci < clusters.length; ci++) {
            const cluster = clusters[ci];
            const pct = 75 + Math.round((ci / totalVerify) * 10);
            onProgress?.(pct, 'Verifying groups...');

            if (cluster.length < 2) {
                verifyResults.push(cluster);
                continue;
            }

            const clusterImages = cluster.map(id => imageMap.get(id)).filter((img): img is BoardImage => img != null);
            const result = await verifyCluster(clusterImages, axis);

            if (!result) {
                verifyResults.push(cluster);
                continue;
            }

            if (result.coherence < AUTO_COHERENCE_THRESHOLD) {
                verifyNoise.push(...cluster);
            } else {
                const outlierSet = new Set(result.outlierIds);
                const kept = cluster.filter(id => !outlierSet.has(id));
                verifyNoise.push(...cluster.filter(id => outlierSet.has(id)));
                if (kept.length > 0) verifyResults.push(kept);
            }
        }

        finalClusters = verifyResults;
    }

    // === NAMING ===
    onProgress?.(87, 'Grouping...');
    const groups: Record<string, string[]> = {};
    const usedNames = new Set<string>();
    for (const cluster of finalClusters) {
        const memberDescs = cluster.map(id => allDescriptions[id]);
        const name = nameClusterFromTags(memberDescs, language, usedNames, axis);
        usedNames.add(name);
        groups[name] = cluster;
    }

    const allNoise = [...noise, ...verifyNoise];
    if (allNoise.length > 0) {
        const othersName = OTHERS_NAME[language] ?? OTHERS_NAME.en;
        groups[othersName] = allNoise;
    }

    onProgress?.(92, 'Grouping...');
    return { groups };
}

interface AutoCandidate {
    axis: BaseAxis;
    memberIds: string[];
    coherence: number;
}

/**
 * AUTO mode: run DBSCAN on all 3 axes, score each cluster by coherence,
 * greedily accept highest-coherence clusters with image-dedup. Per-cluster
 * naming uses the originating axis. Unassigned images fall to Others.
 */
async function classifyImagesAuto(
    _images: BoardImage[],
    allDescriptions: Record<string, ImageDescription>,
    fallbackIds: Set<string>,
    imageMap: Map<string, BoardImage>,
    opts: SubClassifyOpts,
): Promise<AiSortResult> {
    const { maxGroups, verifyClusters, language, onProgress } = opts;
    const effectiveMax = maxGroups === 'auto' ? AUTO_MAX_GROUPS : maxGroups;

    onProgress?.(67, 'Grouping...');

    // === Per-axis DBSCAN → candidate pool ===
    const axisConfigs: Record<BaseAxis, ClusteringConfig> = {
        shape:   { ...DEFAULT_CLUSTERING_CONFIG, weights: AXIS_WEIGHTS.shape,   eps: DEFAULT_EPS_BY_AXIS.shape },
        concept: { ...DEFAULT_CLUSTERING_CONFIG, weights: AXIS_WEIGHTS.concept, eps: DEFAULT_EPS_BY_AXIS.concept },
        color:   { ...DEFAULT_CLUSTERING_CONFIG, weights: AXIS_WEIGHTS.color,   eps: DEFAULT_EPS_BY_AXIS.color },
    };

    const candidates: AutoCandidate[] = [];
    const candidatePoolMax = effectiveMax * 3;

    for (const a of BASE_AXES) {
        const cfg = axisConfigs[a];
        const { clusters } = clusterImagesByFeatures(allDescriptions, cfg, fallbackIds, candidatePoolMax);
        for (const memberIds of clusters) {
            const vectors: ImageFeatureVector[] = [];
            for (const id of memberIds) {
                const d = allDescriptions[id];
                if (d) vectors.push(extractFeatureVector(id, d, false));
            }
            const coherence = clusterCoherence(vectors, cfg);
            if (coherence >= AUTO_COHERENCE_THRESHOLD) {
                candidates.push({ axis: a, memberIds, coherence });
            }
        }
    }

    // === Sort descending by coherence, greedy pick with image-dedup ===
    candidates.sort((a, b) => b.coherence - a.coherence);

    const minPts = DEFAULT_CLUSTERING_CONFIG.minPts;
    const usedIds = new Set<string>();
    const accepted: AutoCandidate[] = [];

    for (const cand of candidates) {
        if (accepted.length >= effectiveMax) break;
        const remaining = cand.memberIds.filter(id => !usedIds.has(id));
        if (remaining.length < minPts) continue;

        const cfg = axisConfigs[cand.axis];
        const vectors = remaining.map(id => extractFeatureVector(id, allDescriptions[id], false));
        const recoherence = clusterCoherence(vectors, cfg);
        if (recoherence < AUTO_COHERENCE_THRESHOLD) continue;

        accepted.push({ axis: cand.axis, memberIds: remaining, coherence: recoherence });
        for (const id of remaining) usedIds.add(id);
    }

    if (process.env.NODE_ENV !== 'production') {
        console.log('[aiSort] AUTO candidates:', {
            generated: candidates.length,
            accepted: accepted.length,
            usedIds: usedIds.size,
            total: Object.keys(allDescriptions).length,
        });
    }

    // === 2-PASS VERIFY (per accepted cluster, against its originAxis) ===
    let finalClusters: AutoCandidate[] = accepted;
    const verifyNoise: string[] = [];

    if (verifyClusters && accepted.length > 0) {
        const verifyResults: AutoCandidate[] = [];
        const totalVerify = accepted.length;

        for (let ci = 0; ci < accepted.length; ci++) {
            const cand = accepted[ci];
            const pct = 75 + Math.round((ci / totalVerify) * 10);
            onProgress?.(pct, 'Verifying groups...');

            if (cand.memberIds.length < 2) {
                verifyResults.push(cand);
                continue;
            }

            const clusterImages = cand.memberIds
                .map(id => imageMap.get(id))
                .filter((img): img is BoardImage => img != null);
            const result = await verifyCluster(clusterImages, cand.axis);

            if (!result) {
                verifyResults.push(cand);
                continue;
            }

            if (result.coherence < AUTO_COHERENCE_THRESHOLD) {
                verifyNoise.push(...cand.memberIds);
            } else {
                const outlierSet = new Set(result.outlierIds);
                const kept = cand.memberIds.filter(id => !outlierSet.has(id));
                verifyNoise.push(...cand.memberIds.filter(id => outlierSet.has(id)));
                if (kept.length > 0) {
                    verifyResults.push({ axis: cand.axis, memberIds: kept, coherence: cand.coherence });
                }
            }
        }

        finalClusters = verifyResults;
    }

    // === NAMING (per cluster originAxis) ===
    onProgress?.(87, 'Grouping...');
    const groups: Record<string, string[]> = {};
    const usedNames = new Set<string>();
    const assignedIds = new Set<string>();

    for (const cand of finalClusters) {
        const memberDescs = cand.memberIds.map(id => allDescriptions[id]);
        const name = nameClusterFromTags(memberDescs, language, usedNames, cand.axis);
        usedNames.add(name);
        groups[name] = cand.memberIds;
        for (const id of cand.memberIds) assignedIds.add(id);
    }

    // === Others: fallback + verifyNoise + everything else unassigned ===
    const noisePool = new Set<string>();
    for (const id of fallbackIds) noisePool.add(id);
    for (const id of verifyNoise) noisePool.add(id);
    for (const id of Object.keys(allDescriptions)) {
        if (!assignedIds.has(id)) noisePool.add(id);
    }
    // Strip any id that ended up assigned (e.g. fallbackId that DBSCAN somehow kept)
    for (const id of assignedIds) noisePool.delete(id);

    if (noisePool.size > 0) {
        const othersName = OTHERS_NAME[language] ?? OTHERS_NAME.en;
        groups[othersName] = Array.from(noisePool);
    }

    onProgress?.(92, 'Grouping...');
    return { groups };
}

const OTHERS_NAME: Record<Language, string> = {
    en: 'Others',
    ko: '기타',
    ja: 'その他',
    id: 'Lainnya',
    es: 'Otros',
    fr: 'Autres',
};
