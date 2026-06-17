import { describe, expect, it } from "vitest";
import viteConfig from "../vite.config.js";

describe("Vite packaged asset paths", () => {
  it("Given Electron loads dist/index.html via file URL When Vite builds Then assets are relative", () => {
    expect(viteConfig).toMatchObject({
      base: "./",
    });
  });
});
