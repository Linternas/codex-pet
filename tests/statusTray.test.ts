import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("macOS status tray", () => {
  it("Given Codex Pet runs on macOS When started Then it uses the menu bar instead of the Dock", async () => {
    const mainSource = await readFile(new URL("../electron/main/index.ts", import.meta.url), {
      encoding: "utf8",
    });

    expect(mainSource).toContain('app.setActivationPolicy("accessory")');
    expect(mainSource).toContain("app.dock?.hide()");
    expect(mainSource).toContain("createStatusTray");
    expect(mainSource).not.toContain("app.dock?.show()");
  });

  it("Given the user clicks the desktop pet When the app activates Then the manager is not opened automatically", async () => {
    const mainSource = await readFile(new URL("../electron/main/index.ts", import.meta.url), {
      encoding: "utf8",
    });

    expect(mainSource).not.toContain('app.on("activate"');
  });

  it("Given the status tray is created When the user opens the menu Then it exposes app controls", async () => {
    const traySource = await readFile(new URL("../electron/main/statusTray.ts", import.meta.url), {
      encoding: "utf8",
    });

    expect(traySource).toContain("new Tray(");
    expect(traySource).toContain("setContextMenu");
    expect(traySource).toContain("Codex Pet 열기");
    expect(traySource).toContain("손쉬운 사용 권한");
    expect(traySource).toContain("종료");
  });
});
