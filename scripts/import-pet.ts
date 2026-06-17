import { homedir } from "node:os";
import { copyCodexPetToProject, installCodexPet } from "../electron/shared/petAssets.js";

async function main(): Promise<void> {
  const petId = process.argv[2] ?? "guga";
  await installCodexPet(petId);
  const pet = await copyCodexPetToProject(petId, {
    homeDir: homedir(),
    projectRoot: process.cwd(),
  });

  console.log(`Saved ${pet.manifest.displayName} to ${pet.spriteUrl}`);
}

try {
  await main();
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
