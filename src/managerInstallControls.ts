import type { PetManagerResult } from "../electron/shared/ipc.js";
import { petIdSchema } from "../electron/shared/petSchema.js";
import type { ManagerRefs } from "./managerView.js";
import { queryOptional, setStatus } from "./managerView.js";

type PetApi = NonNullable<Window["codexPet"]>;

export function bindInstallControls(
  root: ParentNode,
  refs: ManagerRefs,
  api: PetApi,
  onResult: (result: PetManagerResult) => void,
): void {
  api.onInstallProgress((progress) => {
    setStatus(refs, progress.message);
    void api.requestAnimation("running");
  });

  const addForm = queryOptional<HTMLFormElement>(root, "[data-add-form]");
  if (addForm === null || refs.addButton === null || refs.input === null) {
    return;
  }

  const addButton = refs.addButton;
  const input = refs.input;
  addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const petId = input.value.trim();
    const parsedPetId = petIdSchema.safeParse(petId);
    if (!parsedPetId.success) {
      void api.requestAnimation("failed");
      setStatus(refs, "pet id는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.");
      return;
    }

    addButton.disabled = true;
    setStatus(refs, "설치 요청 중");
    void api.requestAnimation("running");
    void api
      .installPet(parsedPetId.data)
      .then(onResult)
      .catch((error: unknown) => {
        void api.requestAnimation("failed");
        setStatus(refs, error instanceof Error ? `추가 실패: ${error.message}` : "추가 실패");
      })
      .finally(() => {
        addButton.disabled = input.disabled;
      });
  });
}
