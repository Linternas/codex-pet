import {
  type ReleaseHistoryResult,
  parseReleaseHistory,
  releaseHistoryApiUrl,
} from "../shared/releaseHistory.js";

type FetchReleases = (url: string, options: RequestInit) => Promise<Response>;

export async function getReleaseHistory(
  fetchReleases: FetchReleases = fetch,
): Promise<ReleaseHistoryResult> {
  try {
    const response = await fetchReleases(releaseHistoryApiUrl, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return {
        kind: "error",
        message:
          response.status === 403 || response.status === 429
            ? "GitHub 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요."
            : "버전 히스토리를 불러오지 못했습니다. 잠시 후 다시 시도하세요.",
      };
    }
    return { kind: "ready", releases: parseReleaseHistory(await response.json()) };
  } catch {
    return {
      kind: "error",
      message: "버전 히스토리를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.",
    };
  }
}
