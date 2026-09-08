import "dotenv/config";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig, type Config } from "../config.js";
import {
  ChatStore,
  createApiTransport,
  createLogTransport,
  sendAlert,
  type SendResult,
  type TelegramTransport,
} from "../telegram/index.js";
import { dummyAlert } from "./schedule.js";

export type SmokeResult = {
  flash: SendResult;
  digest: SendResult;
};

export async function runSmoke(
  config: Config,
  deps?: { store?: ChatStore; transport?: TelegramTransport },
): Promise<SmokeResult> {
  const store = deps?.store ?? new ChatStore();
  const transport =
    deps?.transport ??
    (config.TELEGRAM_DRY_RUN || !config.TELEGRAM_BOT_TOKEN
      ? createLogTransport()
      : createApiTransport(config.TELEGRAM_BOT_TOKEN));
  const chatId = config.TELEGRAM_CHAT_ID || "0";
  store.bind(chatId);

  const flash = await sendAlert(store, transport, {
    chatId,
    alert: dummyAlert("FLASH"),
    dryRun: config.TELEGRAM_DRY_RUN,
  });
  const digest = await sendAlert(store, transport, {
    chatId,
    alert: dummyAlert("DIGEST"),
    dryRun: config.TELEGRAM_DRY_RUN,
  });
  return { flash, digest };
}

const entry = process.argv[1];
const isMain =
  entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href;
if (isMain) {
  runSmoke(loadConfig())
    .then((result) => {
      console.log(`smoke FLASH: ${result.flash.sent ? "sent" : result.flash.reason}`);
      console.log(`smoke DIGEST: ${result.digest.sent ? "sent" : result.digest.reason}`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exit(1);
    });
}
