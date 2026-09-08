export type CollectorContext = {
  now: Date;
};

export type Collector = {
  name: string;
  run(ctx: CollectorContext): Promise<void>;
};
