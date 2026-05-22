import { SiteNav } from '@/components/SiteNav';
import { SiteFooter } from '@/components/SiteFooter';

interface PageShellProps {
  children: React.ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return (
    <>
      <div className="dark-grid-bg" aria-hidden="true" />
      <SiteNav />
      <main style={{ position: 'relative', zIndex: 1, paddingTop: 61 }}>
        {children}
        <div className="section-divider" />
        <SiteFooter />
      </main>
    </>
  );
}
