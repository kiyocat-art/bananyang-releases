/* ─────────────────────────────────────────────────────────────────────────────
   /preview — index page linking to email previews. Public, design-only.
   ───────────────────────────────────────────────────────────────────────────── */

export const dynamic = 'force-static';

export default function PreviewIndex() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0d0d0d',
        color: '#f0f0f0',
        fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 16px',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          background: '#161616',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '40px 36px',
        }}
      >
        <div
          style={{
            width: 36,
            height: 3,
            backgroundColor: '#f5c542',
            borderRadius: 2,
            margin: '0 0 24px 0',
          }}
        />
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 18px 0' }}>Email previews</h1>
        <p style={{ color: '#a0a0a0', fontSize: 14, lineHeight: '22px', margin: '0 0 24px 0' }}>
          Visual-only renders of the transactional emails. No PII, no live send.
        </p>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <li style={{ marginBottom: 12 }}>
            <a
              href="/preview/welcome"
              style={{
                color: '#f5c542',
                fontSize: 15,
                textDecoration: 'none',
              }}
            >
              → Welcome email (sent on signup)
            </a>
          </li>
          <li>
            <a
              href="/preview/launch"
              style={{
                color: '#f5c542',
                fontSize: 15,
                textDecoration: 'none',
              }}
            >
              → Launch announcement (broadcast)
            </a>
          </li>
        </ul>
      </div>
    </main>
  );
}
