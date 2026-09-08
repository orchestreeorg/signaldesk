import type { Decision } from "../domain/index.js";

export type OutgoingAlert = Decision & {
  sourceUrl?: string;
  id?: string;
};

export const FLASH_DAILY_CAP = 4;
