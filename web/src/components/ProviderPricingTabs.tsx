'use client';

import { useState } from 'react';
import { PricingTable } from '@/components/PricingTable';
import {
  GOOGLE_MODELS,
  OPENAI_MATRIX,
  FLUX_MODELS,
  PROVIDER_META,
  type ProviderKey,
} from '@/lib/modelPricing';

interface ProviderPricingTabsProps {
  tableHeaders: {
    model: string;
    resolution: string;
    quality: string;
    pricePerImage: string;
  };
  providerLabels: {
    google: string;
    openai: string;
    flux: string;
  };
  footnoteLabel: {
    google: string;
    openai: string;
    flux: string;
  };
}

export function ProviderPricingTabs({ tableHeaders, providerLabels, footnoteLabel }: ProviderPricingTabsProps) {
  const [provider, setProvider] = useState<ProviderKey>('google');

  const meta = PROVIDER_META[provider];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px' }}>
      {/* Segmented control */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
        <div className="provider-tabs">
          {(['google', 'openai', 'flux'] as ProviderKey[]).map(p => (
            <button
              key={p}
              className={`provider-tab${provider === p ? ' provider-tab-active' : ''}`}
              onClick={() => setProvider(p)}
            >
              {providerLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Google tab */}
      {provider === 'google' && (
        <PricingTable
          rows={GOOGLE_MODELS}
          columns={['model', 'resolution', 'pricePerImage']}
          headers={tableHeaders}
        />
      )}

      {/* OpenAI tab — matrix layout */}
      {provider === 'openai' && (
        <div className="pricing-table-wrapper">
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Quality</th>
                {OPENAI_MATRIX.resolutions.map(res => (
                  <th key={res}>{res}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OPENAI_MATRIX.qualities.map(q => (
                <tr key={q}>
                  <td>
                    <span className="pricing-model-variant">{q}</span>
                  </td>
                  {OPENAI_MATRIX.resolutions.map(res => (
                    <td key={res} className="pricing-price-cell">
                      ${OPENAI_MATRIX.prices[q][res].toFixed(3)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
            Model: gpt-image-2 · Price per image
          </div>
        </div>
      )}

      {/* Flux tab */}
      {provider === 'flux' && (
        <PricingTable
          rows={FLUX_MODELS}
          columns={['resolution', 'pricePerImage']}
          headers={{ ...tableHeaders, resolution: 'Megapixel' }}
        />
      )}

      {/* Footnote */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <a
          href={meta.footnoteUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}
        >
          {footnoteLabel[provider]} ↗
        </a>
      </div>
    </div>
  );
}
