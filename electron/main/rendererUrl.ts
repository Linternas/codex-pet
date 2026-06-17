import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function resolvePackagedRendererUrl(projectRoot: string): string {
  return pathToFileURL(join(projectRoot, "dist", "index.html")).toString();
}

export function resolveRendererUrl(
  projectRoot: string,
  devServerUrl: string | undefined,
  view: "manager" | "overlay" = "manager",
): string {
  const applyView = (url: string): string => {
    const resolvedUrl = new URL(url);
    if (view === "overlay") {
      resolvedUrl.searchParams.set("view", "overlay");
    }

    return resolvedUrl.toString();
  };

  if (devServerUrl !== undefined && devServerUrl.length > 0) {
    return applyView(devServerUrl);
  }

  return applyView(resolvePackagedRendererUrl(projectRoot));
}
