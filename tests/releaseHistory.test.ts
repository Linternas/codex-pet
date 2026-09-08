import { describe, expect, it, vi } from "vitest";
import { getReleaseHistory } from "../electron/main/releaseHistoryService.js";
import { parseReleaseHistory, releaseHistoryApiUrl } from "../electron/shared/releaseHistory.js";

const release = {
  tag_name: "v0.0.1",
  name: "First release",
  body: "Initial release",
  published_at: "2026-06-17T07:55:14Z",
  draft: false,
  prerelease: false,
};
describe("read-only GitHub release history", () => {
  it("omits drafts and unpublished releases, retains prereleases, and sorts by publication date", () => {
    const history = parseReleaseHistory([
      release,
      {
        ...release,
        tag_name: "v0.0.2-beta",
        name: null,
        body: null,
        published_at: "2026-09-01T00:00:00Z",
        prerelease: true,
      },
      { ...release, draft: true },
      { ...release, published_at: null },
    ]);
    expect(history.map((item) => item.version)).toEqual(["v0.0.2-beta", "v0.0.1"]);
    expect(history[0]).toMatchObject({ title: "v0.0.2-beta", notes: "", prerelease: true });
  });
  it("only fetches the fixed release-list endpoint and returns validated metadata", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([release]), { status: 200 }));
    expect(await getReleaseHistory(fetcher)).toMatchObject({
      kind: "ready",
      releases: [{ version: "v0.0.1" }],
    });
    expect(fetcher).toHaveBeenCalledWith(
      releaseHistoryApiUrl,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("returns recoverable errors for rate limits, offline and malformed responses", async () => {
    expect(await getReleaseHistory(async () => new Response("", { status: 403 }))).toMatchObject({
      kind: "error",
      message: expect.stringContaining("요청 한도"),
    });
    expect(
      await getReleaseHistory(async () => {
        throw new Error("offline");
      }),
    ).toMatchObject({ kind: "error" });
    expect(await getReleaseHistory(async () => new Response('{"unexpected":true}'))).toMatchObject({
      kind: "error",
    });
  });
});
