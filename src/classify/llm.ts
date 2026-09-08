import type { Config } from "../config.js";
import type { RawItem } from "../collectors/news/types.js";
import { heuristicLlm } from "./heuristic.js";
import { CLASSIFY_SYSTEM_PROMPT } from "./prompt.js";
import type { LlmExtract } from "./types.js";

export type LlmClient = {
  extract(item: RawItem): Promise<LlmExtract>;
};

export function mockLlm(byUrl: Record<string, LlmExtract>): LlmClient {
  return {
    async extract(item) {
      const hit = byUrl[item.url];
      if (!hit) {
        return { class: "OTHER", assets: [], polarity: 0, summary: "unmapped fixture" };
      }
      return hit;
    },
  };
}

export function createOpenAiCompatibleClient(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): LlmClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return {
    async extract(item) {
      const response = await fetchImpl(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: CLASSIFY_SYSTEM_PROMPT },
            {
              role: "user",
              content: `TITLE: ${item.title}\nURL: ${item.url}\nBODY: ${item.body}`,
            },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(`LLM ${response.status}`);
      }
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        return { class: "OTHER", assets: [], polarity: 0, summary: "" };
      }
      return JSON.parse(content) as LlmExtract;
    },
  };
}

export function createLlmFromConfig(config: Config): LlmClient {
  if (!config.LLM_API_KEY) {
    return heuristicLlm();
  }
  return createOpenAiCompatibleClient({
    baseUrl: config.LLM_BASE_URL,
    apiKey: config.LLM_API_KEY,
    model: config.LLM_MODEL,
  });
}
