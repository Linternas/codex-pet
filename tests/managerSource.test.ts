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
    expect(source).toContain('placeholder="guga"');
  });

  it("Given v0.0.1 manager When rendered Then v0.0.2 download and update UI stays commented", async () => {
    const source = await readManagerSources();

    expect(source).toContain("v0.0.2");
    expect(source).toContain("https://codex-pets.net");
    expect(source).toContain("npx --yes codex-pets add");
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
