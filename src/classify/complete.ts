export const NEAR_NOTE_TIMEOUT_MS = 15_000;
export const NEAR_NOTE_MAX_TOKENS = 180;

export async function completeChat(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  timeoutMs?: number;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const response = await fetchImpl(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.apiKey}`,
    },
    signal: AbortSignal.timeout(opts.timeoutMs ?? NEAR_NOTE_TIMEOUT_MS),
    body: JSON.stringify({
      model: opts.model,
      temperature: 0,
      max_tokens: opts.maxTokens ?? NEAR_NOTE_MAX_TOKENS,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`LLM ${response.status}`);
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}
