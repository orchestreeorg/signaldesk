import type { Collector, CollectorContext } from "./types.js";

const collectors = new Map<string, Collector>();

export function registerCollector(collector: Collector): void {
  collectors.set(collector.name, collector);
}

export function listCollectors(): Collector[] {
  return [...collectors.values()];
}

export function clearCollectors(): void {
  collectors.clear();
}

export async function runCollectors(ctx: CollectorContext): Promise<void> {
  for (const collector of listCollectors()) {
    await collector.run(ctx);
  }
}
