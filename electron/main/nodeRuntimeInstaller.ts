import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { managedNodeRoot } from "../shared/commandEnvironment.js";
import { resolveNodeArchive, verifyNodeArchive } from "../shared/nodeDownload.js";

const exec = promisify(execFile);
let pending: Promise<void> | undefined;

export function installNodeRuntime(root = managedNodeRoot): Promise<void> {
  pending ??= install(root).finally(() => {
    pending = undefined;
  });
  return pending;
}

async function install(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  const staging = await mkdtemp(join(root, ".install-"));
  let retained = false;
  const download = async (url: string, file: string) => {
    await exec(
      "/usr/bin/curl",
      [
        "--fail",
        "--location",
        "--silent",
        "--show-error",
        "--proto",
        "=https",
        "--proto-redir",
        "=https",
        "--connect-timeout",
        "20",
        "--max-time",
        "180",
        "--max-filesize",
        "150000000",
        "--output",
        file,
        url,
      ],
      { timeout: 190_000 },
    );
  };
  try {
    const index = join(staging, "index.json");
    await download("https://nodejs.org/dist/index.json", index);
    const archive = resolveNodeArchive(JSON.parse(await readFile(index, "utf8")), process.arch);
    const tarball = join(staging, "node.tar.gz");
    const sums = join(staging, "SHASUMS256.txt");
    await download(archive.url, tarball);
    await download(archive.checksumsUrl, sums);
    verifyNodeArchive(
      await readFile(sums, "utf8"),
      archive.filename,
      createHash("sha256")
        .update(await readFile(tarball))
        .digest("hex"),
    );
    const runtime = join(staging, "runtime");
    await mkdir(runtime);
    await exec("/usr/bin/tar", ["-xzf", tarball, "--strip-components=1", "-C", runtime], {
      timeout: 60_000,
    });
    const { stdout } = await exec(
      join(runtime, "bin/node"),
      [join(runtime, "lib/node_modules/npm/bin/npx-cli.js"), "--version"],
      { timeout: 15_000 },
    );
    if (!stdout.trim()) throw new Error("설치한 npx를 확인하지 못했습니다.");
    // Only publish the runtime after download, checksum and execution checks pass.
    const link = join(staging, "current");
    await symlink(runtime, link);
    await rename(link, join(root, "current"));
    retained = true;
    await Promise.allSettled([rm(index), rm(tarball), rm(sums)]);
  } finally {
    if (!retained) await rm(staging, { recursive: true, force: true });
  }
}
