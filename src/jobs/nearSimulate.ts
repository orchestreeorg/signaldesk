export function simulateNearHoldingsUsd(tokens: number, price: number): number | null {
  if (!Number.isFinite(tokens) || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  return Number((tokens * price).toFixed(2));
}
