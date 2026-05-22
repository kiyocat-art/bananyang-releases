/**
 * lemonSqueezyPortal.ts — Lemon Squeezy Checkout & Portal
 *
 * Lemon Squeezy API를 이용해 결제 및 고객 관리 포털 URL을 제공합니다.
 */

// ──────────────────────────────────────────────────────────────
// 공개 API
// ──────────────────────────────────────────────────────────────

/**
 * Lemon Squeezy 고객 포털 열기 (Receipt / Invoice 관리)
 * (Lemon Squeezy에서는 결제 완료 후 제공되는 My Orders 링크 혹은 고정된 스토어포털 URL 사용)
 * @param portalUrl Lemon Squeezy Store Customer Portal URL 형태 (스토어 설정에서 확인)
 * @param email 사용자 프리필 이메일
 */
export async function openCustomerPortal(portalUrl: string, email?: string): Promise<void> {
    const url = email
        ? `${portalUrl}?email=${encodeURIComponent(email)}`
        : portalUrl;

    try {
        if (window.electronAPI?.openExternal) {
            await window.electronAPI.openExternal(url);
        } else {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    } catch (e) {
        console.error('[LemonSqueezyPortal] Failed to open portal:', e);
    }
}

/**
 * Lemon Squeezy 결제 페이지(Checkout) 열기
 * @param checkoutUrl Lemon Squeezy 대시보드에서 발급받은 상품 구매 링크 (예: https://store.lemonsqueezy.com/checkout/buy/...)
 * @param email 사용자 프리필(사전입력) 이메일
 */
export async function openCheckout(checkoutUrl: string, email?: string): Promise<void> {
    // Lemon.js 팝업 방식이 연동되어 있다면 팝업을 띄우고, 없으면 브라우저 새 창으로 처리
    if (typeof window !== 'undefined' && (window as any).createLemonSqueezy) {
        (window as any).LemonSqueezy.Url.Open(checkoutUrl + (email ? `?checkout[email]=${encodeURIComponent(email)}` : ''));
        return;
    }

    // 기본 Web URL 조합 (이메일 파라미터는 Lemon Squeezy 규격을 따름 `checkout[email]=...`)
    const finalUrl = email
        ? `${checkoutUrl}${checkoutUrl.includes('?') ? '&' : '?'}checkout[email]=${encodeURIComponent(email)}`
        : checkoutUrl;

    try {
        if (window.electronAPI?.openExternal) {
            await window.electronAPI.openExternal(finalUrl);
        } else {
            window.open(finalUrl, '_blank', 'noopener,noreferrer');
        }
    } catch (e) {
        console.error('[LemonSqueezyPortal] Failed to open checkout:', e);
    }
}
