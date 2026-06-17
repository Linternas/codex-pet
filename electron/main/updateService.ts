import http from "node:http";
import https from "node:https";
import { appMetadata, releaseManifestSchema, releaseUpdateConfig } from "../shared/release.js";
import {
  type UpdateCheckResult,
  createUpdateCheckResult,
  updateCheckResultSchema,
} from "../shared/update.js";

const updateManifestUrlEnv = "CODEX_PET_UPDATE_MANIFEST_URL";
const requestTimeoutMs = 8000;

function resolveUpdateManifestUrl(): string | null {
  const manifestUrl = process.env[updateManifestUrlEnv]?.trim() || releaseUpdateConfig.manifestUrl;
  return manifestUrl === undefined || manifestUrl.length === 0 ? null : manifestUrl;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "업데이트 확인 중 알 수 없는 오류가 발생했습니다.";
}

function readTextFromUrl(url: string): Promise<string> {
  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === "http:" ? http : https;

  return new Promise((resolve, reject) => {
    const request = client.get(parsedUrl, { timeout: requestTimeoutMs }, (response) => {
      const { statusCode = 0 } = response;
      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`업데이트 manifest 요청 실패: HTTP ${statusCode}`));
        return;
      }

      const chunks: string[] = [];
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => chunks.push(chunk));
      response.on("end", () => resolve(chunks.join("")));
    });

    request.on("timeout", () => {
      request.destroy(new Error("업데이트 확인 시간이 초과되었습니다."));
    });
    request.on("error", reject);
  });
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const manifestUrl = resolveUpdateManifestUrl();
  if (manifestUrl === null) {
    return {
      kind: "not-configured",
      message: `${updateManifestUrlEnv}이 설정되지 않았습니다.`,
    };
  }

  try {
    const manifest = releaseManifestSchema.parse(JSON.parse(await readTextFromUrl(manifestUrl)));
    return updateCheckResultSchema.parse(
      createUpdateCheckResult(appMetadata.version, manifestUrl, manifest),
    );
  } catch (error) {
    return {
      kind: "error",
      message: toErrorMessage(error),
    };
  }
}
