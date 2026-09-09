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

  it("accepts run-digest from the ops control API", () => {
    const route = readFileSync(join(here, "../../dashboard/app/api/control/route.ts"), "utf8");
    const page = readFileSync(join(here, "../../dashboard/app/console/page.tsx"), "utf8");
    expect(route).toMatch(/"run-digest"/);
    expect(page).toMatch(/action\("run-digest"\)/);
    expect(page).toMatch(/Send digest now/);
  });
});
