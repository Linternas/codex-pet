import { type InstallerStatus, resolveInstallerStatus } from "../shared/installer.js";

let cachedStatus: InstallerStatus | undefined;

export async function getInstallerStatus(refresh = false): Promise<InstallerStatus> {
  if (refresh || cachedStatus === undefined) {
    cachedStatus = await resolveInstallerStatus();
  }

  return cachedStatus;
}
