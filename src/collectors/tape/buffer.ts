import type { TapeTick } from "./types.js";

export const MAX_TICKS = 20_000;

export class TickBuffer {
  readonly ticks: TapeTick[] = [];

  push(tick: TapeTick): void {
    this.ticks.push(tick);
    const extra = this.ticks.length - MAX_TICKS;
    if (extra > 0) {
      this.ticks.splice(0, extra);
    }
  }

  pushAll(ticks: TapeTick[]): void {
    for (const tick of ticks) {
      this.push(tick);
    }
  }
}
