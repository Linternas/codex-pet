import { describe, expect, it } from "vitest";
import {
  type CommandRunner,
  nodeInstallInstructions,
  resolveInstallerStatus,
} from "../electron/shared/installer.js";

describe("installer status", () => {
  it("Given npx exists When checked Then version is returned", async () => {
    const commandRunner: CommandRunner = async (command, args) => {
      expect(command).toBe("npx");
      expect(args).toEqual(["-v"]);
      return { stdout: "10.9.3\n" };
    };

    await expect(resolveInstallerStatus(commandRunner)).resolves.toEqual({
      npxAvailable: true,
      npxVersion: "10.9.3",
      instructions: null,
    });
  });

  it("Given npx is missing When checked Then install instructions are returned", async () => {
    const commandRunner: CommandRunner = async () => {
      throw new Error("npx not found");
    };

    await expect(resolveInstallerStatus(commandRunner)).resolves.toEqual({
      npxAvailable: false,
      npxVersion: null,
      instructions: nodeInstallInstructions,
    });
  });
});
