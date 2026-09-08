const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

const { app, protocol } = require("electron");

// Apply before loading the asynchronous main module to avoid a Dock icon at startup.
if (process.platform === "darwin") {
  app.setActivationPolicy("accessory");
  app.once("ready", () => app.dock?.hide());
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "pet-asset",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
process.chdir(__dirname);

const mainPath = join(__dirname, "dist-electron", "electron", "main", "index.js");

import(pathToFileURL(mainPath).toString()).catch((error) => {
  console.error("Failed to start Codex Pet Electron main process.");
  console.error(error);
  process.exitCode = 1;
});
