/**
 * 단일 진실 공급원: 결제 금액 검증.
 * UI 표시 문구(i18n.ts)와 분리 — 서버 측 정합성 검사 전용.
 */

export const EXPECTED_PURCHASE_AMOUNT_USD = 19.99;
export const EXPECTED_PURCHASE_CURRENCY = 'USD';

/**
 * 결제 프로바이더 웹훅에서 받은 금액이 기대값과 일치하는지 검증.
 * 부동소수 비교 안전성을 위해 cents 단위(정수)로 비교.
 */
export function isAmountValid(amount: number, currency: string): boolean {
  if (currency !== EXPECTED_PURCHASE_CURRENCY) return false;
  if (!Number.isFinite(amount)) return false;
  const expectedCents = Math.round(EXPECTED_PURCHASE_AMOUNT_USD * 100);
  const actualCents = Math.round(amount * 100);
  return actualCents === expectedCents;
}
