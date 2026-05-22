/**
 * paddlePortal.ts — Paddle Checkout & Customer Portal
 */

/**
 * Paddle 결제 페이지 열기
 * @param checkoutUrl Paddle Checkout URL (https://checkout.paddle.com/checkout/...)
 * @param email 사용자 이메일 (프리필용, custom_data에 포함됨)
 */
export async function openCheckout(checkoutUrl: string, email?: string): Promise<void> {
    const url = email
        ? `${checkoutUrl}${checkoutUrl.includes('?') ? '&' : '?'}customer[email]=${encodeURIComponent(email)}`
        : checkoutUrl;

    try {
        if (window.electronAPI?.openExternal) {
            await window.electronAPI.openExternal(url);
        } else {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    } catch (e) {
        console.error('[PaddlePortal] Failed to open checkout:', e);
    }
}

/**
 * Paddle 고객 포털 열기 (영수증/구독 관리)
 * @param portalUrl Paddle 포털 URL
 * @param email 사용자 이메일
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
        console.error('[PaddlePortal] Failed to open portal:', e);
    }
}
