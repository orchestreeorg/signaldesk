import "dotenv/config";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig, type Config } from "../config.js";
import { startTelegram } from "../telegram/index.js";

export async function startBot(config: Config = loadConfig()): Promise<void> {
  await startTelegram(config);
}

const entry = process.argv[1];
const isMain =
  entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href;
if (isMain) {
  startBot()
    .then(() => {
      process.on("SIGINT", () => process.exit(0));
      process.on("SIGTERM", () => process.exit(0));
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exit(1);
    });
}
