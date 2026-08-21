# Codex Pet 현재 작업 정리

작성일: 2026-06-17

이 문서는 현재 코드 기준으로 구현된 기능과 검증 상태를 정리한다. 일반 사용자용 README가
아니라 개발/정리용 문서다.

## 프로젝트 개요

Codex Pet은 macOS 전용 Electron 앱이다. `codex-pets` spritesheet 에셋을 프로젝트의
`public/pets/<pet-id>`에 저장하고, 투명한 데스크톱 오버레이 창에 캐릭터를 표시한다.

현재 앱 버전은 `v0.0.2`다.

주요 진입점:

- 앱 main: `electron/main/index.ts`
- install workflow: `electron/main/installPetWorkflow.ts`
- overlay window: `electron/main/overlayWindow.ts`
- manager UI: `src/manager.ts`, `src/managerView.ts`, `src/managerInstaller.ts`,
  `src/managerInstallControls.ts`
- overlay UI: `src/overlay.ts`
- native keyboard helper: `native/key-monitor/main.swift`
- DMG packaging: `scripts/package-dmg.mjs`
- release workflow: `.github/workflows/release.yml`

## 현재 구현된 기능

### macOS 앱 형태

- Electron 기반 macOS 전용 앱이다.
- Dock에는 표시하지 않고, 상단 메뉴바 tray로 앱을 제어한다.
- tray 메뉴에서 manager window를 열고, 접근성 권한 화면을 열고, 앱을 종료한다.
- 앱 시작 시 manager window를 자동으로 열지 않는다.
- 캐릭터 overlay 적용/복원 시 manager window가 앞으로 나오지 않는다.

관련 파일:

- `electron/main/index.ts`
- `electron/main/statusTray.ts`
- `tests/statusTray.test.ts`

### 투명 캐릭터 오버레이

- 투명하고 always-on-top인 overlay window를 만든다.
- overlay window는 focusable이 아니며 taskbar 대상도 아니다.
- 캐릭터는 드래그로 이동할 수 있다.
- 우하단 resize handle은 hover 또는 focus/resizing 상태에서만 보인다.
- 기본 scale은 65%, 최대 scale은 100%다.
- manager window의 slider 또는 overlay resize handle로 크기를 조정한다.
- 캐릭터를 클릭하거나 드래그해도 manager window는 열리지 않는다.

관련 파일:

- `electron/main/overlayWindow.ts`
- `src/overlay.ts`
- `src/styles.css`
- `electron/shared/overlay.ts`

### 애니메이션

spritesheet는 8열 x 9행 구조를 기준으로 처리한다.

현재 행 매핑:

1. `idle`
2. `run-right`
3. `run-left`
4. `waving`
5. `jumping`
6. `failed`
7. `waiting`
8. `running`
9. `review`

상태 전환:

- 평상시: `idle`
- 오른쪽 드래그: `run-right`
- 왼쪽 드래그: `run-left`
- hover: `jumping`
- OS 키보드 입력: `waving`
- 추가/다운로드 계열 요청: `running`
- 실패: `failed`

프레임 처리:

- 투명 프레임은 `detectVisibleFrameColumns()`로 제외한다.
- `idle`은 1.0초에서 1.3초 사이 랜덤 duration을 사용한다.
- action별 frame duration을 분리했다.
- `jumping`은 상대적으로 빠르게 처리한다.

관련 파일:

- `electron/shared/petAnimation.ts`
- `src/frameDetection.ts`
- `src/overlay.ts`
- `tests/overlay.test.ts`

### 에셋 관리와 추가

현재 `v0.0.2`에서는 앱 안에서 pet id 기반 추가 UI를 제공한다.

가능한 흐름:

- 이미 프로젝트에 존재하는 `public/pets/<pet-id>` 에셋 목록 표시
- 에셋 카드 클릭 시 적용하지 않고 preview만 수행
- 적용 버튼 클릭 시 overlay에 적용
- 삭제 버튼 클릭 시 프로젝트 저장본 삭제
- 마지막 적용 pet id를 user preferences에 저장하고 앱 재실행 시 복원
- `codex-pets.net` 링크와 pet id 추가 방법 표시
- `npx -v` 체크 결과 표시
- `npx`가 없으면 input/add button disabled 처리
- Node.js/Homebrew 설치 명령 표시
- pet id 입력 후 `npx --yes codex-pets add <pet-id>` 실행
- 설치 환경 확인, 다운로드, 복사, 검증, 적용 단계별 progress 표시
- 추가 중 `running`, 실패 시 `failed` animation 요청
- 잘못된 pet id를 renderer에서 먼저 막고 한국어 메시지 표시
- `pet.json` 없음, invalid manifest, spritesheet 없음, 다운로드 결과 폴더 없음, npx 없음,
  `codex-pets add` 실패를 구분해서 표시

관련 파일:

- `src/manager.ts`
- `src/managerInstallControls.ts`
- `src/managerView.ts`
- `src/managerInstaller.ts`
- `electron/main/installPetWorkflow.ts`
- `electron/main/installerStatus.ts`
- `electron/shared/petAssets.ts`
- `electron/shared/petAssetErrors.ts`
- `electron/shared/petImage.ts`
- `electron/shared/userPreferences.ts`
- `tests/managerSource.test.ts`
- `tests/petAssets.test.ts`

### 접근성 권한과 OS 전체 키보드 감지

OS 전체 키 입력 감지는 Swift native helper가 담당한다.

현재 구조:

- helper app: `dist-native/Codex Pet Keyboard Monitor.app`
- bundle id: `app.mingu.codex-pet.keyboard-monitor`
- 실행 파일: `codex-pet-key-monitor`
- 권한 요청 대상 이름: `Codex Pet Keyboard Monitor`

동작:

- 일반 실행은 접근성 prompt를 반복해서 띄우지 않는다.
- 권한이 없으면 `permission-required`를 출력하고 종료한다.
- Electron main은 `permission-required`를 받으면 2500ms 뒤 재시도한다.
- 접근성 버튼 클릭 시 helper를 `--request-accessibility`로 실행해 macOS 권한 prompt를 유도한다.
- 접근성 설정 화면은 `/usr/bin/open`으로 열고, 400ms 뒤 `osascript`로 `System Settings`
  또는 `System Preferences`를 전면 활성화한다.
- `/usr/bin/open` 실패 시 `shell.openExternal` fallback을 사용한다.
- `System Settings` 활성화 실패 시 `System Preferences` 활성화를 시도한다.
- renderer는 접근성 설정 열기 실패를 상태 메시지로 보여준다.

관련 파일:

- `native/key-monitor/main.swift`
- `scripts/build-key-monitor.mjs`
- `electron/main/keyboardActivity.ts`
- `electron/main/accessibilitySettings.ts`
- `src/manager.ts`
- `tests/accessibilitySettings.test.ts`
- `tests/keyboardActivity.test.ts`
- `tests/statusTray.test.ts`

### 업데이트 확인

- 앱 버전 source of truth는 `package.json`과 `electron/shared/release.ts`의 `appMetadata.version`이다.
- 현재 버전은 `v0.0.2`다.
- manager window의 `업데이트 확인` 버튼은 GitHub release manifest를 확인한다.
- 새 버전이 있으면 `업데이트` 버튼이 나타나고, 버튼을 누르면 DMG 다운로드 URL을 연다.
- 앱 내부 자동 교체 설치는 아직 지원하지 않는다.

관련 파일:

- `electron/shared/release.ts`
- `electron/shared/update.ts`
- `electron/main/updateIpc.ts`
- `electron/main/updateService.ts`
- `src/manager.ts`
- `tests/release.test.ts`
- `tests/update.test.ts`

### 앱 아이콘

- 루트의 `image1.png`를 앱 아이콘 소스로 사용한다.
- `scripts/build-app-icon.mjs`가 `build/Codex-Pet.png`와 `build/Codex-Pet.icns`를 생성한다.
- `image1.png`는 아이콘이 최대한 크게 보이도록 여백을 줄인 상태다.
- `.icns` 생성은 `iconutil` 실패 시 수동 writer fallback을 사용한다.

관련 파일:

- `image1.png`
- `build/Codex-Pet.png`
- `build/Codex-Pet.icns`
- `scripts/build-app-icon.mjs`

### 배포 준비

현재 준비된 것:

- `pnpm package:dmg`로 arm64 DMG 생성 가능
- GitHub release용 최신 버전 manifest 생성
- manifest에는 `version`, `fileName`, `sha256`, `size`, `releaseDate`가 들어간다.
- manifest hash는 최종 DMG 파일 기준으로 계산한다.
- 기본 로컬 packaging은 ad-hoc signing이다.
- `CODEX_PET_CODESIGN_IDENTITY`가 있으면 Developer ID signing과 hardened runtime을 사용한다.
- `CODEX_PET_NOTARIZE=1`이면 `notarytool`, `stapler`, `spctl` 흐름을 실행한다.
- GitHub Actions release workflow skeleton을 추가했다.
- GitHub Release가 없으면 workflow에서 `gh release create`로 생성한 뒤 asset을 업로드한다.

현재 한계:

- 이 repo에는 Apple Developer ID 인증서와 notarization secret이 없다.
- 실제 notarized DMG는 아직 생성/검증하지 않았다.
- 다른 Mac에서 Gatekeeper 경고 없이 실행되는지는 인증서와 공증 후 확인해야 한다.
- 앱 내부 자동 교체 설치는 아직 없다.

관련 파일:

- `scripts/package-dmg.mjs`
- `.github/workflows/release.yml`
- `electron/shared/release.ts`
- `RELEASING.md`

## 최근 수정으로 잠긴 문제

- `npx가 없어 에셋을 추가할 수 없습니다.` 문구 제거
- 앱 시작 시 manager window 자동 열림 제거
- 캐릭터 적용/복원 시 manager window 자동 focus 제거
- 접근성 설정 열기 실패를 renderer에서 삼키지 않도록 변경
- 접근성 설정을 `/usr/bin/open` + `osascript activate`로 전면 활성화
- 버튼, 링크, role button 카드, range input에 `cursor: pointer` 적용
- disabled 버튼은 `cursor: not-allowed`
- `manager.ts`를 250 pure LOC 이하로 유지하기 위해 installer 렌더링을 분리

## 검증 상태

최근 검증한 명령:

```bash
pnpm test -- tests/accessibilitySettings.test.ts tests/managerSource.test.ts tests/petAssets.test.ts
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm package:dmg
```

최근 확인된 결과:

- scoped test: 61 tests passing
- typecheck: passing
- lint: passing
- build: passing
- package:dmg: passing when run outside the Codex sandbox
- generated DMG: `release/Codex-Pet-v0.0.2-darwin-arm64.dmg`
- generated manifest: `release/latest-darwin-arm64.json`
- generated DMG sha256: `d36bd71ed2d25031ad8ec56b1840e0ea32b5c0ca83bd0e9a96cb743d83273da9`
- `src/manager.ts`: 202 pure LOC
- `src/managerInstaller.ts`: 40 pure LOC
- `src/managerInstallControls.ts`: 45 pure LOC
- `electron/shared/petAssets.ts`: 214 pure LOC

macOS 명령 확인:

```bash
/usr/bin/open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
/usr/bin/osascript -e 'tell application "System Settings" to activate'
```

둘 다 로컬에서 exit code 0으로 성공했다.

## 현재 주의할 점

- 실행 중인 앱은 이전 빌드일 수 있으므로 수정 확인 전 앱을 완전히 종료하고 다시 실행해야 한다.
- `hdiutil create`는 Codex sandbox 안에서 `Device not configured`로 실패할 수 있다. 실제 DMG
  생성 확인은 sandbox 밖에서 수행했다.
- 접근성 권한은 `Codex Pet`이 아니라 `Codex Pet Keyboard Monitor`에 부여되어야 한다.
- GitHub Actions release는 secrets가 준비되어야 실제로 성공한다.
- 현재 update UI는 DMG URL 열기까지만 지원한다. 자동 교체 설치는 별도 작업이다.
