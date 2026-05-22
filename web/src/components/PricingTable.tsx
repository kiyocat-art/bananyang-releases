'use client';

import type { ModelRow } from '@/lib/modelPricing';

interface PricingTableProps {
  rows: ModelRow[];
  columns: ('model' | 'resolution' | 'quality' | 'pricePerImage')[];
  headers: Record<string, string>;
}

export function PricingTable({ rows, columns, headers }: PricingTableProps) {
  return (
    <div className="pricing-table-wrapper">
      <table className="pricing-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col}>{headers[col]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const prevRow = i > 0 ? rows[i - 1] : null;
            const showModel = !prevRow || prevRow.model !== row.model;
            return (
              <tr key={i}>
                {columns.map(col => {
                  if (col === 'model') {
                    return (
                      <td key={col}>
                        {showModel && (
                          <span className="pricing-model-name">{row.model}</span>
                        )}
                      </td>
                    );
                  }
                  if (col === 'resolution') {
                    return (
                      <td key={col}>
                        {row.resolution && (
                          <span className="pricing-model-variant">{row.resolution}</span>
                        )}
                      </td>
                    );
                  }
                  if (col === 'quality') {
                    return (
                      <td key={col}>
                        {row.quality && (
                          <span className="pricing-model-variant">{row.quality}</span>
                        )}
                      </td>
                    );
                  }
                  if (col === 'pricePerImage') {
                    return (
                      <td key={col} className="pricing-price-cell">
                        <span style={row.isBold ? { color: 'var(--accent-yellow)' } : undefined}>
                          ${row.pricePerImage.toFixed(3)}
                        </span>
                        {row.notes && (
                          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
                            {row.notes}
                          </span>
                        )}
                      </td>
                    );
                  }
                  return <td key={col} />;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
