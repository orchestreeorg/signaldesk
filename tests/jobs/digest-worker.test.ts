import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("digest job wiring", () => {
  it("does not send dummyAlert DIGEST from the worker", () => {
    const worker = readFileSync(join(here, "../../src/processes/worker.ts"), "utf8");
    expect(worker).toMatch(/buildDigest/);
    expect(worker).toMatch(/sendDigest/);
    expect(worker).not.toMatch(/dummyAlert\("DIGEST"\)/);
  });

  it("enqueues digest-now when the dashboard sends run-digest", () => {
    const worker = readFileSync(join(here, "../../src/processes/worker.ts"), "utf8");
    expect(worker).toMatch(/command\.action === "run-digest"/);
    expect(worker).toMatch(/queues\.digest\.add\("digest-now"/);
  });

  it("branches MACRO jobs to the weekly index send path", () => {
    const worker = readFileSync(join(here, "../../src/processes/worker.ts"), "utf8");
    expect(worker).toMatch(/isMacroJob/);
    expect(worker).toMatch(/emitMacroIndex/);
    expect(worker).toMatch(/command\.action === "run-macro"/);
    expect(worker).toMatch(/queues\.digest\.add\("macro-now"/);
    expect(worker).not.toMatch(/dummyAlert/);
  });

  it("accepts run-digest from the ops control API", () => {
    const route = readFileSync(join(here, "../../dashboard/app/api/control/route.ts"), "utf8");
    const page = readFileSync(join(here, "../../dashboard/app/console/page.tsx"), "utf8");
    expect(route).toMatch(/"run-digest"/);
    expect(page).toMatch(/action\("run-digest"\)/);
    expect(page).toMatch(/Send digest now/);
  });

  it("accepts run-macro from the ops control API", () => {
    const route = readFileSync(join(here, "../../dashboard/app/api/control/route.ts"), "utf8");
    const page = readFileSync(join(here, "../../dashboard/app/console/page.tsx"), "utf8");
    expect(route).toMatch(/"run-macro"/);
    expect(page).toMatch(/action\("run-macro"\)/);
    expect(page).toMatch(/Send index now/);
  });

  it("branches NEAR jobs to the dedicated bot send path", () => {
    const worker = readFileSync(join(here, "../../src/processes/worker.ts"), "utf8");
    expect(worker).toMatch(/isNearJob/);
    expect(worker).toMatch(/emitNearPosition/);
    expect(worker).toMatch(/NEAR_TELEGRAM_BOT_TOKEN/);
    expect(worker).toMatch(/NEAR_TELEGRAM_CHAT_ID/);
    expect(worker).toMatch(/LLM_API_KEY/);
    expect(worker).toMatch(/NEAR note skipped/);
    expect(worker).toMatch(/NEAR note failed/);
    expect(worker).toMatch(/NEAR note attached/);
    expect(worker).toMatch(/command\.action === "run-near"/);
    expect(worker).toMatch(/queues\.digest\.add\("near-now"/);
  });

  it("accepts run-near from the ops control API", () => {
    const route = readFileSync(join(here, "../../dashboard/app/api/control/route.ts"), "utf8");
    const page = readFileSync(join(here, "../../dashboard/app/console/page.tsx"), "utf8");
    expect(route).toMatch(/"run-near"/);
    expect(page).toMatch(/action\("run-near"\)/);
    expect(page).toMatch(/Send NEAR now/);
  });
});
