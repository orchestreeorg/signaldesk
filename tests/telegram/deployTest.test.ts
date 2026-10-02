import { describe, expect, it } from "vitest";
import { DEPLOY_TEST_HTML, sendDeployTest } from "../../src/telegram/send.js";

describe("deploy test telegram ping", () => {
  it("sends the hardcoded desk line", async () => {
    const sent: string[] = [];
    const result = await sendDeployTest(
      {
        async send(_chatId, html) {
          sent.push(html);
        },
      },
      { chatId: "1", dryRun: false },
    );
    expect(result).toEqual({ sent: true, html: DEPLOY_TEST_HTML });
    expect(sent).toEqual(["<b>Actions are working</b>"]);
  });

  it("logs instead of sending when dry-run is on", async () => {
    const sent: string[] = [];
    const result = await sendDeployTest(
      {
        async send(_chatId, html) {
          sent.push(html);
        },
      },
      { chatId: "1", dryRun: true },
    );
    expect(result).toMatchObject({ sent: false, reason: "dry-run" });
    expect(sent).toHaveLength(1);
  });
});
