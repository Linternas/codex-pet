# Codex Pet 향후 작업 문서

작성일: 2026-06-17

이 문서는 앞으로 해야 할 작업을 우선순위와 범위 기준으로 정리한다. 완료된 항목은 현재
코드 기준으로 표시하고, 실제 기기 확인이 필요한 항목은 별도로 남긴다.

## P0: v0.0.2 안정화

### 접근성 권한 플로우 실제 앱 검증

상태: 코드/테스트 보강 완료, 실제 DMG 수동 QA 남음

목표:

- manager의 `접근성 권한 열기` 버튼을 눌렀을 때 System Settings가 실제로 전면에 뜨는지 확인한다.
- 권한 목록에서 `Codex Pet Keyboard Monitor`가 보이는지 확인한다.
- 권한 허용 후 앱 재시작 없이 native helper가 재시도되어 `keyDown`을 받는지 확인한다.
- OS 전체 타이핑 시 overlay가 `waving`으로 전환되는지 확인한다.

완료된 구현:

- `/usr/bin/open`으로 Accessibility pane을 연다.
- `osascript`로 `System Settings` 또는 `System Preferences`를 전면 활성화한다.
- helper를 `--request-accessibility`로 실행해 권한 prompt를 유도한다.
- renderer에서 실패를 상태 메시지로 표시한다.
- `/usr/bin/open` 실패 시 `shell.openExternal` fallback을 사용한다.
- `System Settings` 활성화 실패 시 `System Preferences` 활성화를 시도한다.
- fallback 단위 테스트를 추가했다.

남은 확인 기준:

- System Settings가 뒤에 숨지 않는다.
- 권한 부여 후 아무 앱에서나 키를 입력하면 캐릭터가 `waving` 상태가 된다.
- 권한이 없을 때는 상태가 조용히 실패하지 않고 문제를 알 수 있다.

관련 파일:

- `electron/main/accessibilitySettings.ts`
- `electron/main/keyboardActivity.ts`
- `native/key-monitor/main.swift`
- `src/manager.ts`

### 캐릭터 클릭 시 manager 열림 재검증

상태: 코드/테스트 보강 완료, 실제 앱 수동 QA 남음

목표:

- 캐릭터 overlay 클릭, 드래그, hover 중 manager window가 열리지 않는지 확인한다.
- 앱 시작 시에도 manager window가 자동으로 열리지 않는지 확인한다.
- manager는 상단바 tray의 `Codex Pet 열기`에서만 열리도록 유지한다.

완료된 구현:

- 앱 시작 시 manager window 자동 open 제거
- 캐릭터 적용/복원 시 manager focus 제거
- overlay window는 focusable/taskbar 대상이 아니도록 유지
- 회귀 테스트 추가

남은 확인 기준:

- 캐릭터 단순 클릭: manager window 열리지 않음
- 캐릭터 드래그: 위치만 이동
- 캐릭터 hover: `jumping`만 실행
- 상단바 메뉴 클릭: manager window 열림

관련 파일:

- `electron/main/index.ts`
- `electron/main/overlayWindow.ts`
- `src/overlay.ts`
- `tests/statusTray.test.ts`

### README 정리

상태: 완료

완료된 내용:

- 현재 앱 버전을 `v0.0.2`로 정리
- 메뉴바 앱 동작을 반영
- 일반 사용자 README에서 release 절차를 제거
- 에셋 추가, npx 필요 조건, 접근성 권한 대상, 업데이트 확인 동작을 사용자 관점으로 정리
- release 절차는 `RELEASING.md`로 분리

관련 파일:

- `README.md`
- `RELEASING.md`

## P1: v0.0.2 에셋 검색/다운로드

### codex-pets.net 안내와 추가 기능 복구

상태: 완료

완료된 구현:

- 검색/추가 form 활성화
- 입력창 기본값 `guga` 제거, placeholder만 유지
- `https://codex-pets.net` 링크 표시
- pet id 추가 방법 안내 표시
- `npx -v` 체크 결과 표시
- npx가 없을 때 input/add button disabled
- Node.js/Homebrew 설치 안내 표시
- 다운로드 중 `running`, 실패 시 `failed` 애니메이션 요청
- 설치 환경 확인, 다운로드, 복사, 검증, 적용 progress message 표시
- 잘못된 pet id를 renderer에서 먼저 차단

관련 파일:

- `src/manager.ts`
- `src/managerInstallControls.ts`
- `src/managerInstaller.ts`
- `src/managerView.ts`
- `electron/main/installPetWorkflow.ts`
- `electron/main/installerStatus.ts`
- `electron/shared/petAssets.ts`

### 다운로드 실패/진행 상태 개선

상태: 완료

목표:

- `npx --yes codex-pets add <pet-id>` 실패 이유를 manager에 명확히 보여준다.
- 설치/복사/읽기 단계를 분리해서 상태 메시지를 표시한다.
- 다운로드된 에셋 검증 실패 시 어떤 파일이 문제인지 보여준다.

완료된 확인 기준:

- 잘못된 pet id
- npx 없음
- 네트워크 실패
- pet.json 없음
- spritesheet 없음

## P1: 배포 안정화

### Developer ID 서명과 notarization

상태: 코드 준비 완료, 실제 인증서 기반 검증 남음

완료된 구현:

- 기본 로컬 빌드는 ad-hoc signing 유지
- `CODEX_PET_CODESIGN_IDENTITY`가 있으면 app bundle을 hardened runtime + timestamp로 서명
- Developer ID 사용 시 DMG도 서명
- `CODEX_PET_NOTARIZE=1`이면 `notarytool submit`, `stapler staple`, `spctl` assessment 실행
- `RELEASING.md`에 필요한 환경변수와 release 절차 정리

필요한 외부 준비:

- Apple Developer Program 계정
- Developer ID Application 인증서
- App Store Connect API key 또는 Apple ID notarization credentials
- GitHub repository secrets

현재 한계:

- 로컬 키체인/CI secret에 인증서가 없으면 public notarized release는 만들 수 없다.
- 실제 다른 Mac Gatekeeper 확인은 notarized DMG 생성 후 가능하다.

관련 파일:

- `scripts/package-dmg.mjs`
- `RELEASING.md`
- `tests/release.test.ts`

### GitHub release pipeline

상태: skeleton 추가 완료, secret 준비 후 첫 실행 검증 필요

완료된 구현:

- `.github/workflows/release.yml` 추가
- macOS arm64 runner에서 install/test/typecheck/lint/package 수행
- certificate import keychain step 추가
- App Store Connect API key 파일 생성 step 추가
- `pnpm package:dmg` 실행
- GitHub Release가 없으면 `gh release create`로 생성
- DMG와 `latest-darwin-arm64.json` release asset 업로드

필요한 secret:

- `CODEX_PET_CERTIFICATE_BASE64`
- `CODEX_PET_CERTIFICATE_PASSWORD`
- `CODEX_PET_KEYCHAIN_PASSWORD`
- `CODEX_PET_CODESIGN_IDENTITY`
- `CODEX_PET_NOTARY_PRIVATE_KEY`
- `CODEX_PET_NOTARY_KEY_ID`
- `CODEX_PET_NOTARY_ISSUER_ID`

남은 작업:

- 첫 GitHub Actions 실행 후 certificate import, notarytool, upload 실패 지점을 확인한다.

관련 파일:

- `.github/workflows/release.yml`
- `RELEASING.md`

## P1: 업데이트 기능

### 최신 버전 확인 UI 활성화

상태: 완료

완료된 구현:

- 현재 버전과 GitHub release manifest 비교
- 새 버전이 있으면 다운로드 버튼 표시
- 다운로드 버튼 클릭 시 GitHub release DMG URL 열기
- check 실패 시 manager에 실패 메시지 표시

관련 파일:

- `electron/shared/update.ts`
- `electron/main/updateIpc.ts`
- `electron/main/updateService.ts`
- `src/manager.ts`
- `src/managerView.ts`
- `tests/update.test.ts`
- `tests/managerSource.test.ts`

### 앱 내부 자동 교체 설치

상태: 미구현

목표:

- 사용자가 앱 내부에서 업데이트를 내려받고 교체 설치할 수 있게 한다.

주의:

- macOS 앱이 자기 자신을 교체하는 흐름은 권한, 실행 중인 프로세스 종료, quarantine,
  notarization 상태를 모두 고려해야 한다.
- 제대로 하려면 Electron auto-updater 계열 도입 또는 별도 updater helper가 필요할 수 있다.
- 단순히 DMG를 열어주는 방식이 `v0.0.2`의 현실적인 1차 목표다.

## P2: UX/시각 품질

### manager UI 정리

상태: 일부 완료

완료된 내용:

- 버튼 hover cursor 적용
- disabled cursor 적용
- 오른쪽 preview panel 상단 고정 유지

남은 작업:

- 버튼 크기와 간격을 실제 화면 기준으로 한 번 더 확인한다.
- 다운로드 영역이 활성화된 상태에서 빈 공간과 상태 문구가 어색하지 않은지 확인한다.

관련 파일:

- `src/styles.css`
- `src/manager.ts`
- `src/managerView.ts`

### overlay interaction polishing

상태: 일부 완료

남은 작업:

- resize handle hover 노출이 모든 scale에서 자연스러운지 확인한다.
- 드래그 중 cursor, animation, 위치 이동이 끊기지 않는지 확인한다.
- overlay click이 manager focus로 이어지는 회귀를 실제 앱에서 확인한다.

관련 파일:

- `src/overlay.ts`
- `src/styles.css`
- `electron/main/overlayWindow.ts`

### 애니메이션 품질

상태: 일부 완료

완료된 내용:

- action별 duration 분리
- idle random duration 적용
- hover jumping duration 빠르게 조정

남은 작업:

- 실제 spritesheet 기준으로 `waving`, `jumping`, `running` 속도를 최종 튜닝한다.
- 장시간 idle에서 랜덤 duration이 자연스러운지 확인한다.

관련 파일:

- `electron/shared/petAnimation.ts`
- `src/overlay.ts`

## P2: 테스트/검증 보강

### 실제 Electron 수동 QA 체크리스트

필요한 시나리오:

- `pnpm start`
- app 시작 후 manager가 자동으로 뜨지 않는지
- 상단바 메뉴에서 manager 열기
- 적용된 캐릭터 복원
- 캐릭터 클릭/hover/drag/resize
- 접근성 권한 열기
- 권한 허용 후 OS 전체 키보드 입력 감지
- DMG 빌드 후 설치 실행
- notarized DMG 생성 후 다른 Mac에서 Gatekeeper 경고 없이 실행

### 회귀 테스트 보강

완료된 테스트:

- 접근성 설정 open fallback 단위 테스트
- pet asset missing manifest/spritesheet/source folder 에러 테스트

추가하면 좋은 테스트:

- manager 버튼 실패 상태 표시 테스트를 jsdom 기반으로 강화
- overlay manager focus 방지 테스트를 문자열 검사가 아닌 함수 단위로 강화
- release manifest 생성 결과 snapshot 또는 schema test 보강

## P3: 구조 정리

### main process 분리

`electron/main/index.ts`는 점점 책임이 많아지고 있다.

분리 후보:

- app lifecycle
- manager window
- overlay apply/delete/resize handlers
- tray setup
- accessibility setup
- pet state/preferences

주의:

- 지금은 버그 수정 우선으로 작은 변경을 유지한다.
- 구조 분리는 기능 안정화 후 별도 PR/커밋으로 처리하는 편이 낫다.

### 문서 구조 정리

상태: 완료

현재 구조:

- `README.md`: 일반 사용자용 설치/실행/권한 안내
- `docs/CURRENT_WORK.md`: 현재 구현 상태
- `docs/NEXT_WORK.md`: 향후 작업 계획
- `RELEASING.md`: 개발자용 release 절차

주의:

- 일반 사용자 README에 release 방법을 넣지 않는다.
- 완료되지 않은 기능을 현재 지원되는 것처럼 쓰지 않는다.
