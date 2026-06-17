import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { resolvePackagedRendererUrl } from "../electron/main/rendererUrl.js";

describe("renderer URL resolution", () => {
  it("Given a project root When packaged renderer URL is resolved Then it points at dist/index.html", () => {
    const projectRoot = "/tmp/codex-pet";

    const url = resolvePackagedRendererUrl(projectRoot);

    expect(url).toBe(pathToFileURL(join(projectRoot, "dist", "index.html")).toString());
  });
});
