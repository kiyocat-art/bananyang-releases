export const metadata = {
  title: '점검 중 — BanaNyang',
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
      padding: 24,
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif',
      background: '#0a0a0a',
      color: '#e5e5e5',
    }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>
        서비스 점검 중입니다
      </h1>
      <p style={{ fontSize: 16, color: '#a3a3a3', margin: 0 }}>
        잠시 후 다시 확인해주세요.
      </p>
    </main>
  );
}
