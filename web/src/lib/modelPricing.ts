export type ProviderKey = 'google' | 'openai' | 'flux';

export type ModelRow = {
  model: string;
  resolution?: string;
  quality?: string;
  pricePerImage: number;
  notes?: string;
  isBold?: boolean;
};

export type ProviderMeta = {
  label: string;
  footnote: string;
  footnoteUrl: string;
};

// Mirrored from src/constants.ts MODEL_COSTS
export const GOOGLE_MODELS: ModelRow[] = [
  {
    model: 'gemini-2.5-flash-image',
    resolution: '—',
    pricePerImage: 0.039,
    notes: 'flat rate · 1,290 tokens',
  },
  {
    model: 'gemini-3-pro-image-preview',
    resolution: '1K / 2K',
    pricePerImage: 0.134,
  },
  {
    model: 'gemini-3-pro-image-preview',
    resolution: '4K',
    pricePerImage: 0.240,
  },
  {
    model: 'gemini-3.1-flash-image-preview',
    resolution: '512',
    pricePerImage: 0.045,
  },
  {
    model: 'gemini-3.1-flash-image-preview',
    resolution: '1K',
    pricePerImage: 0.067,
    notes: 'default',
    isBold: true,
  },
  {
    model: 'gemini-3.1-flash-image-preview',
    resolution: '2K',
    pricePerImage: 0.101,
  },
  {
    model: 'gemini-3.1-flash-image-preview',
    resolution: '4K',
    pricePerImage: 0.150,
  },
];

// gpt-image-2: base × multiplier, pre-computed
// base: low=$0.006, medium=$0.053, high=$0.211
// multiplier: 512=0.25, 1K=1, 2K=3.7, 4K=8.3
export const OPENAI_MATRIX = {
  qualities: ['Low', 'Medium', 'High'] as const,
  resolutions: ['512', '1K', '2K', '4K'] as const,
  prices: {
    Low:    { '512': 0.002, '1K': 0.006, '2K': 0.022, '4K': 0.050 },
    Medium: { '512': 0.013, '1K': 0.053, '2K': 0.196, '4K': 0.440 },
    High:   { '512': 0.053, '1K': 0.211, '2K': 0.781, '4K': 1.751 },
  } as Record<string, Record<string, number>>,
} as const;

export const FLUX_MODELS: ModelRow[] = [
  { model: 'flux-2-max', resolution: '0.6 MP', pricePerImage: 0.042 },
  { model: 'flux-2-max', resolution: '1 MP',   pricePerImage: 0.070, notes: 'default', isBold: true },
  { model: 'flux-2-max', resolution: '2 MP',   pricePerImage: 0.140, notes: 'recommended' },
  { model: 'flux-2-max', resolution: '4 MP',   pricePerImage: 0.280 },
];

export const PROVIDER_META: Record<ProviderKey, ProviderMeta> = {
  google: {
    label: 'Google',
    footnote: 'Source: Google AI for Developers / Vertex AI Pricing',
    footnoteUrl: 'https://ai.google.dev/pricing',
  },
  openai: {
    label: 'OpenAI',
    footnote: 'Source: OpenAI Pricing (gpt-image-2)',
    footnoteUrl: 'https://openai.com/api/pricing/',
  },
  flux: {
    label: 'Flux',
    footnote: 'Source: BFL Pricing — $0.07/MP',
    footnoteUrl: 'https://docs.bfl.ai/quick_start/pricing',
  },
};
