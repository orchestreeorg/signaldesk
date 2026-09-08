export type RawItem = {
  sourceId: string;
  sourceRank: number;
  url: string;
  title: string;
  body: string;
  publishedAt: Date;
  simhash: string;
};

export const SIMHASH_NEAR_DUP_BITS = 6;
