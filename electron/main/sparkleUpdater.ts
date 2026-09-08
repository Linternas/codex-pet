import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { App, IpcMain } from "electron";
import {
  type AppUpdateState,
  appUpdateChannels,
  appUpdateStateSchema,
} from "../shared/appUpdate.js";

export function registerSparkleUpdater(
  app: App,
  ipcMain: IpcMain,
  publish: (state: AppUpdateState) => void,
): void {
  const hostPath = resolve(dirname(app.getPath("exe")), "../..");
  const helper = join(
    hostPath,
    "Contents/Helpers/Codex Pet Updater.app/Contents/MacOS/codex-pet-updater",
  );
  let state: AppUpdateState =
    app.isPackaged && existsSync(helper)
      ? { kind: "idle" }
      : { kind: "unavailable", message: "설치한 앱에서 업데이트를 확인할 수 있습니다." };
  let child: ChildProcessWithoutNullStreams | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  function setState(next: AppUpdateState): void {
    state = next;
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = undefined;
    if (next.kind === "checking" || next.kind === "downloading" || next.kind === "verifying") {
      timeout = setTimeout(
        () => {
          const running = child;
          child = undefined;
          running?.kill();
          setState({
            kind: "error",
            message: "업데이트 응답이 지연되고 있습니다. 다시 시도하세요.",
          });
        },
        next.kind === "checking" ? 30_000 : 180_000,
      );
    }
    publish(state);
  }
  function start(): ChildProcessWithoutNullStreams {
    if (child !== undefined) return child;
    const process = spawn(helper, [hostPath], { stdio: "pipe" });
    child = process;
    let buffer = "";
    process.stdout.setEncoding("utf8");
    process.stdout.on("data", (chunk: string) => {
      if (child !== process) return;
      buffer += chunk;
      if (buffer.length > 64 * 1024) {
        process.kill();
        return;
      }
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        try {
          const parsed = appUpdateStateSchema.safeParse(JSON.parse(line));
          if (parsed.success) setState(parsed.data);
        } catch {
          /* Ignore non-protocol output. */
        }
      }
    });
    process.stderr.on("data", () => undefined);
    process.stdin.on("error", () => undefined);
    process.on("error", () => {
      if (child === process) {
        child = undefined;
        setState({ kind: "error", message: "업데이트 도우미를 실행하지 못했습니다." });
      }
    });
    process.on("close", () => {
      if (child !== process) return;
      child = undefined;
      if (!["current", "error", "installing", "installed"].includes(state.kind)) {
        setState({ kind: "error", message: "업데이트가 중단되었습니다. 다시 시도하세요." });
      }
    });
    return process;
  }
  ipcMain.handle(appUpdateChannels.state, () => state);
  ipcMain.handle(appUpdateChannels.check, () => {
    if (!["idle", "current", "error"].includes(state.kind)) return state;
    setState({ kind: "checking" });
    start().stdin.write("check\n");
    return state;
  });
  ipcMain.handle(appUpdateChannels.download, () => {
    if (state.kind !== "available" || child === undefined) return state;
    setState({ ...state, kind: "downloading", progress: 0 });
    child.stdin.write("download\n");
    return state;
  });
  ipcMain.handle(appUpdateChannels.install, () => {
    if (state.kind !== "ready" || child === undefined) return state;
    setState({ ...state, kind: "installing" });
    child.stdin.write("install\n");
    return state;
  });
  app.on("before-quit", () => {
    if (timeout !== undefined) clearTimeout(timeout);
    if (state.kind !== "installing") child?.kill();
  });
}
