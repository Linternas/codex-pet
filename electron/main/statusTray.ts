import { existsSync } from "node:fs";
import { join } from "node:path";
import type electronType from "electron";

const statusIconNames = ["Codex-Pet.png", "Codex-Pet.icns"] as const;
const fallbackIconDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAMRJREFUWEftl0EOgjAQRd/9L3pQTXoANy5cG2/ABXgBNoi0EkvbUzjIKxv8mQkzM0na9hQEcM4JYwCmABsA70oj5uJfRAA24C4QGgA2wzAJoOhl8vLSExEAM8A7IHq9oswB3QpUBrCb9H6LiE8JdQYwAvTOhXpV5jwAAOAiPx3r6uRGWm+6mQBLUrr6QJ9UeXmvW7yaFqsqUO4CDqQ6l7qxXKTPYj8N7s6b4DjZc7eWVrCIy+6csS7LmEMN4/AFU4cyQ4RrGDAAAAAElFTkSuQmCC";

type NativeImageModule = typeof electronType.nativeImage;
type MenuModule = typeof electronType.Menu;
type TrayConstructor = typeof electronType.Tray;
export type StatusTray = { readonly refresh: () => void };

export type CreateStatusTrayOptions = {
  readonly Menu: MenuModule;
  readonly Tray: TrayConstructor;
  readonly nativeImage: NativeImageModule;
  readonly projectRoot: string;
  readonly openManager: () => void;
  readonly petReady: () => boolean;
  readonly petVisible: () => boolean;
  readonly autoWalk: () => boolean;
  readonly clickThrough: () => boolean;
  readonly toggleVisibility: () => void;
  readonly toggleAutoWalk: () => void;
  readonly toggleClickThrough: () => void;
  readonly openAccessibilitySettings: () => void;
  readonly quit: () => void;
};

function resolveStatusIconCandidates(projectRoot: string): readonly string[] {
  return [
    ...statusIconNames.map((name) => join(process.resourcesPath, name)),
    ...statusIconNames.map((name) => join(projectRoot, "build", name)),
  ];
}

function createStatusIcon(
  nativeImage: NativeImageModule,
  projectRoot: string,
): ReturnType<NativeImageModule["createFromPath"]> {
  for (const candidate of resolveStatusIconCandidates(projectRoot)) {
    if (!existsSync(candidate)) {
      continue;
    }

    const image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) {
      return image.resize({ width: 18, height: 18 });
    }
  }

  return nativeImage.createFromDataURL(fallbackIconDataUrl);
}

export function createStatusTray({
  Menu,
  Tray,
  nativeImage,
  projectRoot,
  openManager,
  petReady,
  petVisible,
  autoWalk,
  clickThrough,
  toggleVisibility,
  toggleAutoWalk,
  toggleClickThrough,
  openAccessibilitySettings,
  quit,
}: CreateStatusTrayOptions): StatusTray {
  const tray = new Tray(createStatusIcon(nativeImage, projectRoot));
  tray.setToolTip("Codex Pet");
  function refresh(): void {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Codex Pet 열기",
          click: openManager,
        },
        {
          label: petVisible() ? "캐릭터 숨기기" : "캐릭터 다시 표시",
          enabled: petReady(),
          click: toggleVisibility,
        },
        {
          label: autoWalk() ? "자동 산책 멈추기" : "자동 산책 시작",
          click: toggleAutoWalk,
        },
        {
          label: "클릭 통과",
          type: "checkbox",
          checked: clickThrough(),
          click: toggleClickThrough,
        },
        {
          label: "손쉬운 사용 권한",
          click: openAccessibilitySettings,
        },
        { type: "separator" },
        {
          label: "종료",
          click: quit,
        },
      ]),
    );
  }
  refresh();
  tray.on("click", openManager);

  return { refresh };
}
