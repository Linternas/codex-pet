import { type InstallerStatus, resolveInstallerStatus } from "../shared/installer.js";

let cachedStatus: InstallerStatus | undefined;

export async function getInstallerStatus(): Promise<InstallerStatus> {
  if (cachedStatus === undefined) {
    cachedStatus = await resolveInstallerStatus();
  }

  return cachedStatus;
}
