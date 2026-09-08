import { ops } from "../../ops/log.js";
import type { Asset, FeatureSnapshot } from "../../domain/index.js";
import { buildFeatureSnapshots } from "../../features/snapshot.js";
import { quietSnapshot } from "../../jobs/newsDesk.js";
import { TickBuffer } from "./buffer.js";
import { fetchOpenInterest } from "./oi.js";
import type { TapeTick } from "./types.js";

export type PersistMark = (input: { ts: Date; asset: Asset; mid: number }) => Promise<void>;

export class TapeRuntime {
  readonly buffer = new TickBuffer();
  private readonly lastMark = new Map<Asset, number>();

  constructor(
    private readonly persistMark?: PersistMark,
    private readonly fetchOi: typeof fetchOpenInterest = fetchOpenInterest,
  ) {}

  ingest(tick: TapeTick): void {
    this.buffer.push(tick);
    if (tick.kind === "mark" && tick.price !== null) {
      void this.maybePersist(tick);
    }
  }

  async pollOi(): Promise<void> {
    try {
      const ticks = await this.fetchOi();
      this.buffer.pushAll(ticks);
      ops("tape", "oi.ok", `Open interest tick: ${ticks.length} mark(s), buffer=${this.buffer.ticks.length}`, {
        level: "ok",
        data: { ticks: ticks.length, buffer: this.buffer.ticks.length },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      ops("tape", "oi.skip", `Ignoring OI poll: ${message}`, {
        level: "skip",
        data: { reason: message },
      });
    }
  }

  async snapshotFor(asset: Asset, now = new Date()): Promise<FeatureSnapshot> {
    const snapshots = await buildFeatureSnapshots(this.buffer.ticks, now);
    return snapshots.find((row) => row.asset === asset) ?? quietSnapshot(asset, now);
  }

  private async maybePersist(tick: TapeTick): Promise<void> {
    if (!this.persistMark || tick.price === null) {
      return;
    }
    const last = this.lastMark.get(tick.asset) ?? 0;
    if (tick.ts.getTime() - last < 1_000) {
      return;
    }
    this.lastMark.set(tick.asset, tick.ts.getTime());
    await this.persistMark({ ts: tick.ts, asset: tick.asset, mid: tick.price });
  }
}
