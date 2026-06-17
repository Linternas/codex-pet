const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

process.chdir(__dirname);

const mainPath = join(__dirname, "dist-electron", "electron", "main", "index.js");

import(pathToFileURL(mainPath).toString()).catch((error) => {
  console.error("Failed to start Codex Pet Electron main process.");
  console.error(error);
  process.exitCode = 1;
});
