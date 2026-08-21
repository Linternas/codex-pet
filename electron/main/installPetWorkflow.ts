import type { InstallerStatus } from "../shared/installer.js";
import type {
  InstallPetRequest,
  InstallProgress,
  PetIdRequest,
  PetManagerResult,
} from "../shared/ipc.js";
import {
  copyCodexPetFilesToProject,
  installCodexPet,
  readProjectPet,
} from "../shared/petAssets.js";

type InstallPetWorkflowOptions = {
  readonly applyPet: (request: PetIdRequest) => Promise<PetManagerResult>;
  readonly getInstallerStatus: () => Promise<InstallerStatus>;
  readonly homeDir: string;
  readonly projectRoot: string;
  readonly sendProgress: (progress: InstallProgress) => void;
};

function progress(
  phase: InstallProgress["phase"],
  petId: string,
  message: string,
): InstallProgress {
  return { phase, petId, message };
}

export async function installPetWithProgress(
  request: InstallPetRequest,
  options: InstallPetWorkflowOptions,
): Promise<PetManagerResult> {
  const { petId } = request;
  options.sendProgress(progress("checking", petId, "설치 환경 확인 중"));
  const installer = await options.getInstallerStatus();
  if (!installer.npxAvailable) {
    throw new Error("Node.js 설치 후 에셋 추가를 사용할 수 있습니다.");
  }

  options.sendProgress(
    progress("downloading", petId, `다운로드 중: npx --yes codex-pets add ${petId}`),
  );
  await installCodexPet(petId);

  options.sendProgress(progress("copying", petId, `프로젝트로 복사 중: public/pets/${petId}`));
  await copyCodexPetFilesToProject(petId, {
    homeDir: options.homeDir,
    projectRoot: options.projectRoot,
  });

  options.sendProgress(progress("validating", petId, `에셋 검증 중: public/pets/${petId}`));
  await readProjectPet(petId, { homeDir: options.homeDir, projectRoot: options.projectRoot });

  options.sendProgress(progress("applying", petId, "캐릭터 적용 중"));
  return await options.applyPet({ petId });
}
