import { DEFAULT_DESK_SETTINGS } from "../desk/defaults.js";
import type { DeskSettings } from "../desk/types.js";
import type { Decision, Event } from "../domain/index.js";
import { fuse, type LiveThesis } from "../fusion/index.js";
import type { FeatureSnapshot } from "../domain/index.js";
import { ChatStore } from "../telegram/store.js";
import { sendAlert, type SendResult, type TelegramTransport } from "../telegram/send.js";
import { ops } from "../ops/log.js";
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
  private settings: DeskSettings = DEFAULT_DESK_SETTINGS;

  constructor(private readonly opts: PolicyOptions) {}

  applySettings(settings: DeskSettings): void {
    this.settings = settings;
    this.opts.store.setFlashDailyCap(settings.flashDailyCap);
  }

  thesisFor(asset: string): LiveThesis | undefined {
    return this.theses.get(asset);
  }

  async handle(event: Event, snapshot: FeatureSnapshot, now = new Date()): Promise<EmitResult[]> {
    const live = this.thesisFor(snapshot.asset) ?? null;
    const raw = fuse({
      event,
      snapshot,
      live,
      thresholds: {
        highNovelty: this.settings.highNovelty,
        highCredibility: this.settings.highCredibility,
        fadeCredibility: this.settings.fadeCredibility,
        loudNarrative: this.settings.loudNarrative,
      },
    });
    const decisions = raw.filter((decision) => {
      if (decision.kind === "FLASH" && !this.settings.flashEnabled) {
        return false;
      }
      if (decision.kind === "FADE" && !this.settings.fadeEnabled) {
        return false;
      }
      return true;
    });
    if (raw.length > 0 && decisions.length === 0) {
      ops("policy", "hold", `No alert: ${raw[0]?.kind} disabled in Parameters`, {
        level: "skip",
        data: { kind: raw[0]?.kind, flashEnabled: this.settings.flashEnabled, fadeEnabled: this.settings.fadeEnabled },
      });
    } else if (decisions.length === 0) {
      ops("policy", "hold", `No alert: fusion held ${event.class} ${event.assets.join("/")} cred=${event.credibility}`, {
        level: "skip",
        data: {
          class: event.class,
          assets: event.assets,
          credibility: event.credibility,
          polarity: event.polarity,
          novelty: event.novelty,
        },
      });
    }
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
        ops("policy", "hold", `CONFIRM skipped: already confirmed for ${decision.asset}`, {
          level: "skip",
          data: { asset: decision.asset },
        });
        return { decision, send: { sent: false, html: "", reason: "confirm-cap" } };
      }
    }

    const persisted = this.opts.persist
      ? await this.opts.persist(decision, event.fingerprint)
      : true;
    if (!persisted) {
      ops("policy", "hold", `${decision.kind} skipped: duplicate fingerprint`, {
        level: "skip",
        data: { kind: decision.kind, fingerprint: event.fingerprint },
      });
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
      ops("policy", "emit", `${decision.kind} ${decision.asset} ${send.sent ? "sent" : send.reason}`, {
        level: "ok",
        data: { kind: decision.kind, asset: decision.asset, reason: send.sent ? "sent" : send.reason },
      });
    } else {
      ops("policy", "hold", `${decision.kind} not sent: ${send.reason}`, {
        level: "skip",
        data: { kind: decision.kind, reason: send.reason },
      });
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
