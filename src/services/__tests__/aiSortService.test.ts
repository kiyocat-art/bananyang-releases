/**
 * aiSortService.test.ts
 * Pure-function unit tests for the DBSCAN-based image clustering pipeline.
 *
 * Run: npx vitest run src/services/__tests__/aiSortService.test.ts
 *
 * The service module pulls in geminiService → authService, which touches
 * localStorage at module-init. Stub those globals before importing.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// Stub browser globals before any transitive import touches them.
const fakeStore: Record<string, string> = {};
const fakeLocalStorage = {
    getItem: (k: string) => fakeStore[k] ?? null,
    setItem: (k: string, v: string) => { fakeStore[k] = v; },
    removeItem: (k: string) => { delete fakeStore[k]; },
    clear: () => { for (const k of Object.keys(fakeStore)) delete fakeStore[k]; },
    key: () => null,
    length: 0,
};
vi.stubGlobal('localStorage', fakeLocalStorage);
vi.stubGlobal('window', {
    localStorage: fakeLocalStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { hostname: 'localhost', protocol: 'http:' },
});

type AiSortModule = typeof import('../aiSortService');
let mod: AiSortModule;
beforeAll(async () => {
    mod = await import('../aiSortService');
});

type Desc = Parameters<AiSortModule['extractFeatureVector']>[1];
type ImageFeatureVector = ReturnType<AiSortModule['extractFeatureVector']>;

const makeDesc = (overrides: Partial<Desc> = {}): Desc => ({
    style: 'anime',
    subject: 'single_character',
    finish: 'fully_colored',
    purpose: 'final',
    palette: 'warm',
    mood: 'peaceful',
    shape: 'humanoid_single',
    ...overrides,
} as Desc);

describe('extractFeatureVector', () => {
    it('caches enum indices matching SUBJECT/STYLE/MOOD/PALETTE order', () => {
        const v = mod.extractFeatureVector('img-1', makeDesc({
            subject: 'background',
            style: 'sketch',
            mood: 'cyberpunk',
            palette: 'cool',
        }));
        expect(v.id).toBe('img-1');
        expect(v.subject).toBe('background');
        expect(v.style).toBe('sketch');
        expect(v.mood).toBe('cyberpunk');
        expect(v.palette).toBe('cool');
        expect(v.subjectIdx).toBe(3);
        expect(v.styleIdx).toBe(2);
        expect(v.moodIdx).toBe(1);
        expect(v.paletteIdx).toBe(1);
    });

    it('falls back to safe indices for unknown enum values', () => {
        const v = mod.extractFeatureVector('img-x', makeDesc({
            subject: 'invented_subject' as any,
            style: 'invented_style' as any,
        }));
        expect(v.subjectIdx).toBeGreaterThanOrEqual(0);
        expect(v.styleIdx).toBeGreaterThanOrEqual(0);
    });
});

describe('weightedDistance', () => {
    it('returns 0 for identical vectors', () => {
        const a = mod.extractFeatureVector('a', makeDesc());
        const b = mod.extractFeatureVector('b', makeDesc());
        expect(mod.weightedDistance(a, b, mod.DEFAULT_CLUSTERING_CONFIG)).toBe(0);
    });

    it('returns 1 for fully different vectors', () => {
        const a = mod.extractFeatureVector('a', makeDesc());
        const b = mod.extractFeatureVector('b', makeDesc({
            subject: 'background',
            style: 'sketch',
            mood: 'cyberpunk',
            palette: 'cool',
        }));
        expect(mod.weightedDistance(a, b, mod.DEFAULT_CLUSTERING_CONFIG)).toBeCloseTo(1, 10);
    });

    it('returns palette weight only when only palette differs', () => {
        const a = mod.extractFeatureVector('a', makeDesc());
        const b = mod.extractFeatureVector('b', makeDesc({ palette: 'cool' }));
        expect(mod.weightedDistance(a, b, mod.DEFAULT_CLUSTERING_CONFIG)).toBeCloseTo(0.10, 10);
    });

    it('returns subject weight only when only subject differs', () => {
        const a = mod.extractFeatureVector('a', makeDesc());
        const b = mod.extractFeatureVector('b', makeDesc({ subject: 'background' }));
        expect(mod.weightedDistance(a, b, mod.DEFAULT_CLUSTERING_CONFIG)).toBeCloseTo(0.45, 10);
    });

    it('is symmetric', () => {
        const a = mod.extractFeatureVector('a', makeDesc());
        const b = mod.extractFeatureVector('b', makeDesc({ style: 'sketch', palette: 'cool' }));
        const cfg = mod.DEFAULT_CLUSTERING_CONFIG;
        expect(mod.weightedDistance(a, b, cfg)).toBeCloseTo(mod.weightedDistance(b, a, cfg), 10);
    });
});

describe('dbscan', () => {
    const make = (id: string, d: Partial<Desc>): ImageFeatureVector =>
        mod.extractFeatureVector(id, makeDesc(d));

    it('forms one cluster when all vectors are identical', () => {
        const vecs = ['a', 'b', 'c'].map(id => make(id, {}));
        const { clusters, noise } = mod.dbscan(vecs, { ...mod.DEFAULT_CLUSTERING_CONFIG, autoTune: false });
        expect(clusters).toHaveLength(1);
        expect(clusters[0]).toHaveLength(3);
        expect(noise).toHaveLength(0);
    });

    it('places clear outliers into noise', () => {
        const vecs = [
            make('a', {}),
            make('b', {}),
            make('c', { subject: 'background', style: 'sketch', mood: 'cyberpunk', palette: 'cool' }),
        ];
        const { clusters, noise } = mod.dbscan(vecs, { ...mod.DEFAULT_CLUSTERING_CONFIG, autoTune: false, minPts: 2, eps: 0.2 });
        expect(clusters).toHaveLength(1);
        expect(clusters[0].sort()).toEqual(['a', 'b']);
        expect(noise).toEqual(['c']);
    });

    it('separates two dense balls with no noise', () => {
        const ballA = ['a1', 'a2', 'a3'].map(id => make(id, {}));
        const ballB = ['b1', 'b2', 'b3'].map(id =>
            make(id, { subject: 'background', style: 'sketch', mood: 'cyberpunk', palette: 'cool' }),
        );
        const { clusters, noise } = mod.dbscan([...ballA, ...ballB], {
            ...mod.DEFAULT_CLUSTERING_CONFIG, autoTune: false, minPts: 2, eps: 0.2,
        });
        expect(clusters).toHaveLength(2);
        expect(clusters.map(c => c.length).sort()).toEqual([3, 3]);
        expect(noise).toHaveLength(0);
    });

    it('returns empty for empty input', () => {
        const { clusters, noise } = mod.dbscan([], mod.DEFAULT_CLUSTERING_CONFIG);
        expect(clusters).toEqual([]);
        expect(noise).toEqual([]);
    });

    it('reclaims border points that were initially marked as noise', () => {
        const vecs = [
            make('core1', {}),
            make('core2', {}),
            make('border', { palette: 'cool' }),
            make('core3', {}),
            make('outlier', { subject: 'background', style: 'sketch', mood: 'cyberpunk', palette: 'monochrome' }),
        ];
        const { clusters, noise } = mod.dbscan(vecs, {
            ...mod.DEFAULT_CLUSTERING_CONFIG, autoTune: false, minPts: 2, eps: 0.15,
        });
        const main = clusters.find(c => c.includes('core1'));
        expect(main).toBeDefined();
        expect(main).toContain('border');
        expect(noise).toContain('outlier');
    });
});

describe('autoTuneDbscanParams', () => {
    const make = (id: string, d: Partial<Desc>): ImageFeatureVector =>
        mod.extractFeatureVector(id, makeDesc(d));

    it('uses lenient defaults for very small datasets (N < 6)', () => {
        const vecs = [make('a', {}), make('b', {})];
        const tuned = mod.autoTuneDbscanParams(vecs, mod.DEFAULT_CLUSTERING_CONFIG);
        expect(tuned.minPts).toBe(2);
        expect(tuned.eps).toBeGreaterThanOrEqual(0.45);
    });

    it('returns clamped eps for medium datasets', () => {
        const vecs = Array.from({ length: 30 }, (_, i) =>
            make(`img-${i}`, i < 15 ? {} : { subject: 'background', style: 'sketch' }),
        );
        const tuned = mod.autoTuneDbscanParams(vecs, mod.DEFAULT_CLUSTERING_CONFIG);
        expect(tuned.eps).toBeGreaterThanOrEqual(0.15);
        expect(tuned.eps).toBeLessThanOrEqual(0.50);
    });

    it('skips scanning at very large N and uses defaults', () => {
        const vecs = Array.from({ length: 600 }, (_, i) => make(`img-${i}`, {}));
        const tuned = mod.autoTuneDbscanParams(vecs, mod.DEFAULT_CLUSTERING_CONFIG);
        expect(tuned.eps).toBe(mod.DEFAULT_CLUSTERING_CONFIG.eps);
        expect(tuned.minPts).toBe(3);
    });
});

describe('clusterImagesByFeatures', () => {
    it('routes fallback-tagged images directly to noise', () => {
        const descriptions: Record<string, Desc> = {
            'a': makeDesc({}),
            'b': makeDesc({}),
            'c': makeDesc({}),
            'fallback': makeDesc({ subject: 'other', style: 'other', mood: 'other', palette: 'neutral' }),
        };
        const fallbackIds = new Set(['fallback']);
        const { clusters, noise } = mod.clusterImagesByFeatures(
            descriptions, { ...mod.DEFAULT_CLUSTERING_CONFIG, autoTune: false, eps: 0.2 }, fallbackIds,
        );
        expect(clusters).toHaveLength(1);
        expect(clusters[0]).toEqual(expect.arrayContaining(['a', 'b', 'c']));
        expect(noise).toContain('fallback');
    });

    it('handles dataset with only fallback ids', () => {
        const descriptions: Record<string, Desc> = {
            'x': makeDesc({}),
            'y': makeDesc({}),
        };
        const fallbackIds = new Set(['x', 'y']);
        const { clusters, noise } = mod.clusterImagesByFeatures(descriptions, mod.DEFAULT_CLUSTERING_CONFIG, fallbackIds);
        expect(clusters).toEqual([]);
        expect(noise.sort()).toEqual(['x', 'y']);
    });

    it('produces deterministic output for identical inputs', () => {
        const descriptions: Record<string, Desc> = Object.fromEntries(
            Array.from({ length: 15 }, (_, i) => [
                `img-${i}`,
                makeDesc(i < 8 ? {} : { subject: 'background', style: 'sketch', mood: 'cyberpunk' }),
            ]),
        );
        const r1 = mod.clusterImagesByFeatures(descriptions, mod.DEFAULT_CLUSTERING_CONFIG);
        const r2 = mod.clusterImagesByFeatures(descriptions, mod.DEFAULT_CLUSTERING_CONFIG);
        expect(r1).toEqual(r2);
    });
});

describe('nameClusterFromTags', () => {
    const usedNames = () => new Set<string>();

    it('returns a label combining style + subject in the requested language', () => {
        const name = mod.nameClusterFromTags([makeDesc({})], 'en', usedNames());
        expect(name).toMatch(/Anime.*Characters/);
    });

    it('disambiguates on collision with mood suffix', () => {
        const used = new Set(['Anime Characters']);
        const name = mod.nameClusterFromTags([makeDesc({})], 'en', used);
        expect(name).not.toBe('Anime Characters');
        expect(name).toMatch(/^Anime Characters \(/);
    });

    it('appends numeric suffix when both primary and disambig are taken', () => {
        const used = new Set(['Anime Characters', 'Anime Characters (Peaceful)']);
        const name = mod.nameClusterFromTags([makeDesc({})], 'en', used);
        expect(name).toMatch(/^Anime Characters #\d+$/);
    });

    it('uses majority vote across members', () => {
        const members = [
            makeDesc({ subject: 'single_character' }),
            makeDesc({ subject: 'single_character' }),
            makeDesc({ subject: 'background' }),
        ];
        const name = mod.nameClusterFromTags(members, 'en', usedNames());
        expect(name).toMatch(/Characters/);
        expect(name).not.toMatch(/Backgrounds/);
    });

    it('supports Korean language labels', () => {
        const name = mod.nameClusterFromTags([makeDesc({})], 'ko', usedNames());
        expect(name).toContain('캐릭터');
    });
});
