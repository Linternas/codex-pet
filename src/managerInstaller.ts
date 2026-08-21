import type { PetManagerState } from "../electron/shared/ipc.js";
import type { ManagerRefs } from "./managerView.js";

export function renderInstallerState(refs: ManagerRefs, state: PetManagerState): void {
  if (refs.installerStatus !== null) {
    refs.installerStatus.hidden = false;
  }

  if (state.installer.npxAvailable) {
    if (refs.input !== null) {
      refs.input.disabled = false;
    }
    if (refs.addButton !== null) {
      refs.addButton.disabled = false;
    }
    if (refs.installHelp !== null) {
      refs.installHelp.hidden = true;
    }
    if (refs.installerStatus !== null) {
      refs.installerStatus.textContent = `npx ${state.installer.npxVersion} 확인됨`;
    }
    return;
  }

  if (refs.input !== null) {
    refs.input.disabled = true;
  }
  if (refs.addButton !== null) {
    refs.addButton.disabled = true;
  }
  if (refs.installHelp !== null) {
    refs.installHelp.hidden = false;
  }
  if (refs.installerStatus !== null) {
    refs.installerStatus.textContent = "Node.js 설치 후 에셋 추가를 사용할 수 있습니다.";
  }
  if (refs.homebrewCommand !== null) {
    refs.homebrewCommand.textContent = state.installer.instructions.homebrewInstallCommand;
  }
  if (refs.nodeCommand !== null) {
    refs.nodeCommand.textContent = state.installer.instructions.nodeInstallCommand;
  }
}
