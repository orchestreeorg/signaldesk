import { z } from "zod";

const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") {
      return true;
    }
    if (typeof value === "boolean") {
      return value;
    }
    return !["0", "false", "no"].includes(value.toLowerCase());
  });

const booleanDefaultFalse = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === "" || typeof value === "boolean") {
      return value === true;
    }
    return ["1", "true", "yes"].includes(value.toLowerCase());
  });

const envSchema = z.object({
  DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid URL" }),
  REDIS_URL: z.string().url({ message: "REDIS_URL must be a valid URL" }),
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_CHAT_ID: z.string().default(""),
  TELEGRAM_DRY_RUN: booleanFromEnv,
  NEWS_LIVE: booleanDefaultFalse,
  TAPE_LIVE: booleanDefaultFalse,
  LLM_API_KEY: z.string().default(""),
  LLM_BASE_URL: z.string().default("https://api.openai.com/v1"),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  BTC_LARGE_TX_BTC: z.preprocess(
    (value) => (value === undefined || value === "" ? 5000 : value),
    z.coerce.number().finite().gte(1).lte(21_000_000),
  ),
  MEMPOOL_API_BASE: z.preprocess(
    (value) => (value === undefined || value === "" ? "https://mempool.space/api" : value),
    z.string().url({ message: "MEMPOOL_API_BASE must be a valid URL" }),
  ),
});

export type Config = z.output<typeof envSchema>;

function readEnv(env: NodeJS.ProcessEnv) {
  return {
    DATABASE_URL: env.DATABASE_URL,
    REDIS_URL: env.REDIS_URL,
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID,
    TELEGRAM_DRY_RUN: env.TELEGRAM_DRY_RUN,
    NEWS_LIVE: env.NEWS_LIVE,
    TAPE_LIVE: env.TAPE_LIVE,
    LLM_API_KEY: env.LLM_API_KEY,
    LLM_BASE_URL: env.LLM_BASE_URL,
    LLM_MODEL: env.LLM_MODEL,
    BTC_LARGE_TX_BTC: env.BTC_LARGE_TX_BTC,
    MEMPOOL_API_BASE: env.MEMPOOL_API_BASE,
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(readEnv(env));
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid config: ${details}`);
  }
  return parsed.data;
}
