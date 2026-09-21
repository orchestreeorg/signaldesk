import { describe, expect, it } from "vitest";
import { completeChat } from "../../src/classify/complete.js";

describe("completeChat", () => {
  it("returns plain text from chat completions", async () => {
    const text = await completeChat({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "k",
      model: "gpt-4o-mini",
      system: "sys",
      user: "usr",
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as {
          temperature: number;
          max_tokens: number;
          response_format?: unknown;
        };
        expect(body.temperature).toBe(0);
        expect(body.max_tokens).toBe(180);
        expect(body.response_format).toBeUndefined();
        return new Response(JSON.stringify({ choices: [{ message: { content: "  MARK line  " } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    expect(text).toBe("MARK line");
  });

  it("throws when the API is not ok", async () => {
    await expect(
      completeChat({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "k",
        model: "gpt-4o-mini",
        system: "sys",
        user: "usr",
        fetchImpl: async () => new Response("nope", { status: 429 }),
      }),
    ).rejects.toThrow(/LLM 429/);
  });
});
