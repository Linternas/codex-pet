import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("manager source", () => {
  async function readManagerSources(): Promise<string> {
    const manager = await readFile(new URL("../src/manager.ts", import.meta.url), "utf8");
    const managerView = await readFile(new URL("../src/managerView.ts", import.meta.url), "utf8");
    return `${manager}\n${managerView}`;
  }

  it("Given the pet id input When manager renders Then it has no hard-coded default pet id", async () => {
    const source = await readManagerSources();

    expect(source).not.toContain('value="guga"');
    expect(source).toContain('placeholder="frieren-full"');
  });

  it("Given manager When rendered Then Node installation refreshes status automatically", async () => {
    const source = await readManagerSources();

    expect(source).toContain("data-download-node");
    expect(source).toContain("api.refreshInstaller()");
    expect(source).not.toContain("data-refresh-installer");
    expect(source).not.toContain("updateCheckButton: query");
    expect(source).not.toContain("refs.updateCheckButton.addEventListener");
  });

  it("Given an existing asset card When clicked Then it previews without applying", async () => {
    const source = await readManagerSources();

    expect(source).toContain('card.setAttribute("role", "button")');
    expect(source).toContain("runtime.previewPetId = petId");
    expect(source).toContain("event.stopPropagation()");
  });
});
