import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const root = process.cwd();
const config = JSON.parse(readFileSync(join(root, "build/sparkle.json"), "utf8"));
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const archive = resolve(process.argv[2]);
const tool = join(root, ".cache/sparkle", config.version, "bin/sign_update");
const signature = execFileSync(tool, ["--account", config.keychainAccount, "-p", archive], {
  encoding: "utf8",
}).trim();
if (!/^[A-Za-z0-9+/]{86}==$/.test(signature)) throw new Error("Invalid Sparkle signature");
const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const url = `https://github.com/Linternas/codex-pet/releases/download/v${version}/${basename(archive)}`;
const feed = join(dirname(archive), "appcast.xml");
writeFileSync(
  feed,
  `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel>
<title>Codex Pet</title><link>https://github.com/Linternas/codex-pet/releases</link><description>Codex Pet updates</description><language>ko</language>
<item><title>Codex Pet v${escapeXml(version)}</title><pubDate>${new Date().toUTCString()}</pubDate>
<sparkle:version>${escapeXml(version)}</sparkle:version><sparkle:shortVersionString>${escapeXml(version)}</sparkle:shortVersionString>
<sparkle:minimumSystemVersion>12.0</sparkle:minimumSystemVersion>
<enclosure url="${escapeXml(url)}" sparkle:edSignature="${signature}" length="${statSync(archive).size}" type="application/octet-stream" />
</item></channel></rss>\n`,
);
execFileSync(tool, ["--account", config.keychainAccount, feed], { stdio: "inherit" });
execFileSync(tool, ["--account", config.keychainAccount, "--verify", feed], { stdio: "inherit" });
console.log(`Created signed ${feed}`);
