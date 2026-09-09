import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("dashboard themes", () => {
  it("ships finance, clear, studio, and markets as a catalog, defaulting to finance", () => {
    const theme = readFileSync(join(here, "../../dashboard/lib/theme.ts"), "utf8");
    const css = readFileSync(join(here, "../../dashboard/app/globals.css"), "utf8");
    const picker = readFileSync(join(here, "../../dashboard/lib/theme-picker.tsx"), "utf8");
    const nav = readFileSync(join(here, "../../dashboard/lib/nav.tsx"), "utf8");
    expect(theme).toContain('THEME_IDS = ["finance", "clear", "studio", "markets"]');
    expect(theme).toContain('DEFAULT_THEME: ThemeId = "finance"');
    expect(theme).not.toMatch(/sendAlert|grammy|tapePolarity/i);
    expect(picker).toContain("THEMES.map");
    expect(picker).toContain("theme-menu");
    expect(nav).toContain("<ThemeMenu />");
    expect(css).toContain('[data-theme="finance"]');
    expect(css).toContain('[data-theme="clear"]');
    expect(css).toContain('[data-theme="studio"]');
    expect(css).toContain('[data-theme="markets"]');
  });
});
