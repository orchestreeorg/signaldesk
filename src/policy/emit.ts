import type { Decision, Event } from "../domain/index.js";
import { fuse, type LiveThesis } from "../fusion/index.js";
import type { FeatureSnapshot } from "../domain/index.js";
import { ChatStore } from "../telegram/store.js";
import { sendAlert, type SendResult, type TelegramTransport } from "../telegram/send.js";
import type { OutgoingAlert } from "../telegram/types.js";

export type EmitResult = {
  decision: Decision;
  send: SendResult | { sent: false; html: string; reason: "duplicate" | "confirm-cap" };
};

export type PolicyOptions = {
  store: ChatStore;
  transport: TelegramTransport;
  chatId: string;
  dryRun: boolean;
  persist?: (decision: Decision, fingerprint: string) => Promise<boolean>;
};

export class Policy {
  private readonly theses = new Map<string, LiveThesis>();

  constructor(private readonly opts: PolicyOptions) {}

  thesisFor(asset: string): LiveThesis | undefined {
    return this.theses.get(asset);
  }

  async handle(event: Event, snapshot: FeatureSnapshot, now = new Date()): Promise<EmitResult[]> {
    const live = this.thesisFor(snapshot.asset) ?? null;
    const decisions = fuse({ event, snapshot, live });
    const out: EmitResult[] = [];
    for (const decision of decisions) {
      out.push(await this.emit(decision, event, now));
    }
    return out;
  }

  async emit(decision: Decision, event: Event, now = new Date()): Promise<EmitResult> {
    if (decision.kind === "CONFIRM") {
      const live = this.theses.get(decision.asset);
      if (live?.confirmed) {
        return { decision, send: { sent: false, html: "", reason: "confirm-cap" } };
      }
    }

    const persisted = this.opts.persist
      ? await this.opts.persist(decision, event.fingerprint)
      : true;
    if (!persisted) {
      return { decision, send: { sent: false, html: "", reason: "duplicate" } };
    }

    const alert: OutgoingAlert = {
      ...decision,
      id: event.id,
      sourceUrl: event.url,
    };
    const send = await sendAlert(this.opts.store, this.opts.transport, {
      chatId: this.opts.chatId,
      alert,
      dryRun: this.opts.dryRun,
      now,
    });

    if (send.sent || send.reason === "dry-run") {
      this.remember(decision, event);
    }
    return { decision, send };
  }

  private remember(decision: Decision, event: Event): void {
    if (decision.kind === "FLASH") {
      this.theses.set(decision.asset, {
        fingerprint: event.fingerprint,
        eventId: event.id,
        asset: decision.asset,
        polarity: event.polarity,
        kill: decision.kill,
        confirmed: false,
      });
    }
    if (decision.kind === "CONFIRM") {
      const live = this.theses.get(decision.asset);
      if (live) {
        live.confirmed = true;
      }
    }
    if (decision.kind === "INVALIDATE") {
      this.theses.delete(decision.asset);
    }
  }
}
