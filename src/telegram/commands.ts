import type { Asset } from "../domain/index.js";
import { renderCommand } from "./html.js";
import { ChatStore } from "./store.js";

const ASSETS = new Set<Asset>(["BTC", "ETH"]);

export type CommandReply = {
  html: string;
};

function parseAssets(args: string[]): Asset[] {
  return args
    .map((part) => part.toUpperCase())
    .filter((part): part is Asset => ASSETS.has(part as Asset));
}

export function handleCommand(store: ChatStore, chatId: string, text: string, now = new Date()): CommandReply {
  const [raw, ...args] = text.trim().split(/\s+/);
  const command = (raw ?? "").split("@")[0]?.toLowerCase() ?? "";

  if (command === "/start") {
    store.bind(chatId);
    return { html: renderCommand("START", `bound ${chatId}. Quiet until the first DIGEST.`) };
  }
  if (command === "/watch") {
    const watch = store.setWatch(chatId, parseAssets(args));
    return { html: renderCommand("WATCH", watch.watch.join(" ")) };
  }
  if (command === "/mute") {
    const minutes = Number(args[0] ?? "60");
    const safe = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
    store.mute(chatId, safe, now);
    return { html: renderCommand("MUTE", `FLASH muted ${safe} minutes. DIGEST still goes.`) };
  }
  if (command === "/regime") {
    return { html: renderCommand("REGIME", "stub: vol / funding / ETF 5d / DXY — B3+E2 fill this.") };
  }
  if (command === "/why") {
    const id = args[0] ?? "missing-id";
    return { html: renderCommand("WHY", `stub: features for ${id}`) };
  }
  if (command === "/last") {
    return { html: renderCommand("LAST", "stub: last 5 alerts + resolve state") };
  }
  return { html: renderCommand("START", "unknown command") };
}
