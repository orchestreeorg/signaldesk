import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("NEAR desk isolation", () => {
  it("does not send Telegram or touch fusion", () => {
    const lots = readFileSync(join(here, "../../src/jobs/nearLots.ts"), "utf8");
    const news = readFileSync(join(here, "../../src/jobs/nearNews.ts"), "utf8");
    const price = readFileSync(join(here, "../../src/jobs/nearPrice.ts"), "utf8");
    const desk = readFileSync(join(here, "../../src/jobs/nearDesk.ts"), "utf8");
    const route = readFileSync(join(here, "../../dashboard/app/api/near/route.ts"), "utf8");
    const lotsRoute = readFileSync(join(here, "../../dashboard/app/api/near/lots/route.ts"), "utf8");
    const page = readFileSync(join(here, "../../dashboard/app/near/page.tsx"), "utf8");
    const sim = readFileSync(join(here, "../../src/jobs/nearSimulate.ts"), "utf8");
    const fuse = readFileSync(join(here, "../../src/fusion/fuse.ts"), "utf8");
    expect(lots).not.toMatch(/sendAlert|sendDigest|sendHeadline|grammy|tapePolarity/i);
    expect(news).not.toMatch(/sendAlert|sendDigest|sendHeadline|grammy|tapePolarity|persistRawItems/i);
    expect(price).not.toMatch(/sendAlert|sendDigest|sendHeadline|grammy|tapePolarity/i);
    expect(desk).not.toMatch(/sendAlert|sendDigest|sendHeadline|grammy|tapePolarity|fuse\(/i);
    expect(desk).toMatch(/loadNearPrice/);
    expect(page).toMatch(/live \$NEAR|Live \$NEAR/i);
    expect(route).not.toMatch(/grammy|sendAlert|sendDigest|dashSecret|x-dash-secret|DASH_SECRET/i);
    expect(lotsRoute).not.toMatch(/grammy|sendAlert|sendDigest|dashSecret|x-dash-secret|DASH_SECRET/i);
    expect(page).not.toMatch(/dangerouslySetInnerHTML/);
    expect(page).toMatch(/Record lot/);
    expect(page).toMatch(/NEAR news/);
    expect(page).not.toMatch(/DASH_SECRET|dashHeaders|x-dash-secret/);
    expect(page).toMatch(/NearPriceSimulator|Simulate/);
    expect(sim).not.toMatch(/sendAlert|sendDigest|sendHeadline|grammy|tapePolarity/i);
    expect(fuse).not.toMatch(/nearLots|loadNearNews|nearDesk|loadNearPrice|nearSimulate|nearHourly|emitNearPosition|NEAR Protocol/i);
  });
});
