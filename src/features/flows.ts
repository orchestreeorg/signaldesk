import type { Asset } from "../domain/index.js";

/**
 * External capital-flow z-scores (exchange netflow, stablecoin mint/burn).
 * Implement with Glassnode/CryptoQuant later. Do not invent numbers.
 */
export type FlowAdapter = {
  exchangeNetflowZ(asset: Asset, at: Date): Promise<number | null>;
  stablecoinDeltaZ(asset: Asset, at: Date): Promise<number | null>;
};

export const nullFlowAdapter: FlowAdapter = {
  async exchangeNetflowZ() {
    return null;
  },
  async stablecoinDeltaZ() {
    return null;
  },
};
