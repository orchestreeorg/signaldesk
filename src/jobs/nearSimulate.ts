export function simulateNearHoldingsUsd(tokens: number, price: number): number | null {
  if (!Number.isFinite(tokens) || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  return Number((tokens * price).toFixed(2));
}

/** Live mark when a quote exists; otherwise remaining book. Same number Position and Holdings use. */
export function nearPositionUsd(input: { tokens: number; book: number; price?: number | null }): number {
  const mark = input.price == null ? null : simulateNearHoldingsUsd(input.tokens, input.price);
  if (mark != null) {
    return mark;
  }
  return Number.isFinite(input.book) ? input.book : 0;
}
