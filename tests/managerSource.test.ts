import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("manager source", () => {
  async function readManagerSources(): Promise<string> {
    const manager = await readFile(new URL("../src/manager.ts", import.meta.url), "utf8");
    const managerInstallControls = await readFile(
      new URL("../src/managerInstallControls.ts", import.meta.url),
      "utf8",
    );
    const managerInstaller = await readFile(
      new URL("../src/managerInstaller.ts", import.meta.url),
      "utf8",
    );
    const managerView = await readFile(new URL("../src/managerView.ts", import.meta.url), "utf8");
    return `${manager}\n${managerInstallControls}\n${managerInstaller}\n${managerView}`;
  }

  it("Given the pet id input When manager renders Then it has no hard-coded default pet id", async () => {
    const source = await readManagerSources();

    expect(source).not.toContain('value="guga"');
    expect(source).toContain('placeholder="guga"');
  });

  it("Given v0.0.2 manager When rendered Then asset download and update UI is active", async () => {
    const source = await readManagerSources();

    expect(source).toContain("https://codex-pets.net");
    expect(source).toContain("npx --yes codex-pets add");
    expect(source).toContain("updateCheckButton: queryOptional");
    expect(source).toContain('refs.updateCheckButton?.addEventListener("click"');
  });

  it("Given asset install is enabled When npx is missing Then Node instructions are shown without the old warning", async () => {
    const source = await readManagerSources();

    expect(source).not.toContain("npx가 없어 에셋을 추가할 수 없습니다.");
    expect(source).toContain("Node.js 설치가 필요합니다.");
    expect(source).toContain("Node.js 설치 후 에셋 추가를 사용할 수 있습니다.");
  });

  it("Given asset install fails When the install promise rejects Then the error is shown", async () => {
    const source = await readManagerSources();

    expect(source).toContain(".installPet(parsedPetId.data)");
    expect(source).toContain(".catch((error: unknown)");
    expect(source).toContain("추가 실패");
  });

  it("Given asset install runs When install progress changes Then manager shows each step", async () => {
    const source = await readManagerSources();

    expect(source).toContain("onInstallProgress");
    expect(source).toContain("progress.message");
    expect(source).toContain("pet id는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.");
  });

  it("Given Accessibility settings fails to open When the button is clicked Then the error is shown", async () => {
    const source = await readManagerSources();

    expect(source).not.toContain("void api.openAccessibilitySettings();");
    expect(source).toContain(".catch((error: unknown)");
    expect(source).toContain("접근성 권한 설정을 열지 못했습니다");
  });

  it("Given an existing asset card When clicked Then it previews without applying", async () => {
    const source = await readManagerSources();

    expect(source).toContain('card.setAttribute("role", "button")');
    expect(source).toContain("runtime.previewPetId = petId");
    expect(source).toContain("event.stopPropagation()");
  });
});
