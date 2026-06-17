import type { IpcMain, Shell } from "electron";
import { petChannels } from "../shared/ipc.js";
import { type UpdateCheckResult, updateDownloadRequestSchema } from "../shared/update.js";
import { checkForUpdate } from "./updateService.js";

export function registerUpdateIpcHandlers(ipcMain: IpcMain, shell: Shell): void {
  ipcMain.handle(petChannels.checkUpdate, async (): Promise<UpdateCheckResult> => {
    return await checkForUpdate();
  });

  ipcMain.handle(
    petChannels.openUpdateDownload,
    async (_event, payload: unknown): Promise<void> => {
      const { downloadUrl } = updateDownloadRequestSchema.parse(payload);
      await shell.openExternal(downloadUrl);
    },
  );
}
