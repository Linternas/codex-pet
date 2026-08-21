# Codex Pet Mac

현재 앱 버전은 `v0.0.2`입니다.

Codex Pet은 macOS 전용 Electron 앱입니다. `codex-pets` 에셋을 프로젝트의
`public/pets/<pet-id>`에 저장하고, 투명한 데스크톱 오버레이 창에 캐릭터를 표시합니다.

## 주요 기능

- 상단 메뉴바 앱: Dock에는 표시하지 않고 macOS 상단바에서 관리합니다.
- 에셋 추가: 앱에서 pet id를 입력하면 `npx --yes codex-pets add <pet-id>`를 실행합니다.
- 에셋 관리: 저장된 에셋을 preview, apply, delete 할 수 있습니다.
- 투명 오버레이: 캐릭터를 항상 위에 표시하고 드래그로 이동할 수 있습니다.
- 크기 조정: 기본 65%, 최대 100%입니다.
- 애니메이션: idle, run, waving, jumping, failed, waiting, running, review 상태를 표시합니다.
- 키보드 반응: macOS Accessibility 권한을 받으면 OS 전체 키 입력 시 `waving` 상태로 전환합니다.
- 업데이트 확인: GitHub release manifest를 확인하고 새 DMG 다운로드를 열 수 있습니다.

## 실행

```bash
pnpm install
pnpm import:guga
pnpm start
```

`pnpm start` 후 앱은 상단 메뉴바에 표시됩니다. manager window는 자동으로 열리지 않으며,
상단바 메뉴의 `Codex Pet 열기`로 엽니다.

## 에셋 추가

1. [codex-pets.net](https://codex-pets.net/)에서 사용할 pet id를 확인합니다.
2. manager window의 입력창에 pet id를 입력합니다.
3. `추가` 버튼을 누르면 앱이 `npx --yes codex-pets add <pet-id>`를 실행합니다.
4. 다운로드된 에셋은 `public/pets/<pet-id>`에 저장됩니다.
5. `적용` 버튼을 누르면 데스크톱 오버레이에 캐릭터가 표시됩니다.

이미 다운로드된 에셋 카드를 클릭하면 바로 적용하지 않고 preview만 표시합니다.

## Node.js와 npx

에셋 추가는 `npx`가 필요합니다. 앱은 실행 시 `npx -v`로 설치 여부를 확인합니다.

`npx`가 없으면 입력창과 추가 버튼이 비활성화되고, 앱 안에서 Node.js 설치 명령을 안내합니다.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node
```

설치 후 앱을 다시 실행하면 `npx -v`를 다시 확인합니다.

## 손쉬운 사용 권한

OS 전체 키보드 입력 감지는 macOS Accessibility 권한이 필요합니다.

권한 대상 이름은 `Codex Pet Keyboard Monitor`입니다. `Codex Pet` 본앱이 아니라 keyboard
monitor helper에 권한을 줘야 합니다.

앱에서 `접근성 권한 열기`를 누르면 System Settings의 Accessibility 화면을 열고 전면으로
가져옵니다.

직접 열어야 한다면 아래 경로를 사용합니다.

```text
System Settings > Privacy & Security > Accessibility
```

권한을 허용한 뒤 앱은 native helper를 재시도합니다. 정상 동작하면 다른 앱에서 키를 입력해도
캐릭터가 `waving` 상태로 바뀝니다.

## 캐릭터 조작

- hover: `jumping`
- 드래그 오른쪽: `run-right`
- 드래그 왼쪽: `run-left`
- 키보드 입력: `waving`
- 에셋 추가 중: `running`
- 실패: `failed`

캐릭터를 클릭하거나 드래그해도 manager window는 열리지 않습니다. manager window는 상단바
메뉴에서만 엽니다.

## 앱 아이콘

앱 아이콘은 pet 에셋 경로와 별도로 관리됩니다.

`scripts/build-app-icon.mjs`는 프로젝트 루트의 `image1.png` 또는 `image1.jpg`를 읽어
아래 파일을 생성합니다.

- `build/Codex-Pet.png`
- `build/Codex-Pet.icns`

권장 입력 파일:

- 1024x1024 PNG
- 투명 배경이 필요하면 alpha channel이 있는 PNG
- 파일명: `image1.png`
- 위치: repository root

## 저장 경로

- Codex pet 원본: `~/.codex/pets/<pet-id>`
- 프로젝트 저장본: `public/pets/<pet-id>`
- 화면 표시 이미지: `public/pets/<pet-id>/spritesheet.webp`
- keyboard helper: `dist-native/Codex Pet Keyboard Monitor.app`

## 업데이트 확인

manager window의 `업데이트 확인` 버튼은 GitHub release manifest를 확인합니다.

새 버전이 있으면 `업데이트` 버튼이 나타나고, 버튼을 누르면 DMG 다운로드 URL을 엽니다.
앱 내부 자동 교체 설치는 아직 지원하지 않습니다.

## 개발 명령

```bash
pnpm start
pnpm dev:app
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm package:dmg
```

## 참고 문서

- 현재 작업 정리: `docs/CURRENT_WORK.md`
- 향후 작업 정리: `docs/NEXT_WORK.md`
- 개발자용 release 절차: `RELEASING.md`
