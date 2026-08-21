import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("manager preview sizing", () => {
  it("Given raster pet sprites When the manager preview renders Then the preview remains capped", async () => {
    const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

    expect(styles).toContain("min-height: 300px;");
    expect(styles).toContain("width: min(42%, 230px);");
    expect(styles).toContain("max-height: 240px;");
  });

  it("Given asset cards When action buttons render Then they stay compact", async () => {
    const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

    expect(styles).toContain(".asset-actions button {\n");
    expect(styles).toContain("  flex: 0 0 auto;\n");
    expect(styles).toContain("  min-height: 30px;\n");
    expect(styles).toContain("  padding: 0 12px;\n");
    expect(styles).toContain("  font-size: 12px;\n");
  });

  it("Given interactive manager controls When hovered Then they use a pointer cursor", async () => {
    const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

    expect(styles).toContain("button:not(:disabled),\n");
    expect(styles).toContain("a[href],\n");
    expect(styles).toContain('[role="button"],\n');
    expect(styles).toContain('input[type="range"] {\n');
    expect(styles).toContain("  cursor: pointer;\n");
    expect(styles).toContain("button:disabled {\n  cursor: not-allowed;");
  });
});
