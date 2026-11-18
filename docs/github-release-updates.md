# Sparkle 앱 업데이트

구현일: 2026-09-08. 무료 오픈소스 Sparkle 2.9.6을 앱에 포함합니다.
라이선스 및 포함 라이브러리 고지는 [Sparkle.txt](licenses/Sparkle.txt)에 보존합니다.

## 사용자 화면

설정 창을 처음 열 때 업데이트를 확인합니다. 새 버전이 있으면 헤더에 **업데이트** 버튼이
나타나며, 누르면 버전 히스토리의 업데이트 패널로 이동합니다.
현재 버전 / 최신 버전 → 업데이트 다운로드 → 진행률 → 재시작하여 설치 순서입니다.
다운로드는 사용자 클릭으로 시작합니다. 설치 준비 후 앱을 종료하면 Sparkle이 종료 시 설치할 수도 있습니다.
개발 실행에서는 설치본에서만 가능하다는 상태를 표시합니다.

화면 예시의 v0.0.3은 UI 검증용 데이터이며 실제 게시된 릴리스가 아닙니다.

## 구성

- `build/sparkle.json`: 고정된 Sparkle 버전·SHA256, 공개키, feed URL, Keychain 계정.
- `native/updater/main.m`: Sparkle SPUUpdater / SPUUserDriver를 사용한 별도 네이티브 도우미.
- `electron/main/sparkleUpdater.ts`: 도우미 실행, 검증된 JSON 상태, IPC, 시간 초과 처리.
- `src/appUpdateView.ts`: 헤더 알림과 다운로드·설치 버튼.
- 앱의 `Contents/Helpers`에 도우미와 Sparkle.framework를 포함합니다.
- 앱은 ad-hoc 방식으로 서명합니다. Sparkle Ed25519 키는 업데이트 ZIP과 feed의 서명에 사용합니다.
- 자동 다운로드는 끄고, 서명된 feed와 압축 해제 전 업데이트 검증을 요구합니다.

## 릴리스 만들기

현재 배포 대상은 macOS ARM64입니다. 배포 머신의 로그인 Keychain에
`app.mingu.codex-pet` 계정의 Sparkle 개인키가 있어야 합니다.
개인키는 저장소 또는 앱에 포함하지 않습니다. 기존 키가 있는 환경에서 새 키를 생성하지 마세요.
다른 배포 머신은 기존 키를 안전하게 이전해야 합니다.

1. package.json과 electron/shared/release.ts 버전을 함께 올리고 패치 노트를 갱신합니다.
2. `pnpm package:dmg`로 빌드합니다. 최초 실행은 Sparkle 공식 바이너리를 내려받고 SHA256을 검증합니다.
3. 동일한 GitHub Release의 태그 `v<version>`에 다음 파일을 게시합니다.
   - `Codex-Pet-v<version>-darwin-arm64.dmg`: 최초 수동 설치용
   - `Codex-Pet-v<version>-darwin-arm64.zip`: Sparkle 업데이트용
   - `appcast.xml`: ZIP URL·버전·크기·서명 및 feed 자체 서명
4. 안정 릴리스를 Latest로 지정합니다. 앱은
   `https://github.com/Linternas/codex-pet/releases/latest/download/appcast.xml`을 읽습니다.

`create-appcast.mjs`가 ZIP과 feed를 Keychain 키로 서명하고 feed 서명을 검증합니다.
서명 후 ZIP이나 XML을 수정하면 안 됩니다. 키가 없거나 서명 검증이 실패하면 패키징을 중단합니다.
기존 latest-darwin-arm64.json도 호환을 위해 생성하지만 Sparkle은 읽지 않습니다.
아이콘은 투명 배경의 build/Codex-Pet-source.png에서 생성합니다.

v0.0.3에서 v0.0.4로 업데이트한 뒤 macOS가 손쉬운 사용 권한을 거부한 사례가 있습니다.
업데이트로 ad-hoc 서명이 바뀌면 손쉬운 사용 권한을 다시 허용해야 할 수 있습니다.

## 검증과 한계

- 실제 macOS에서 별도 테스트 번들 0.0.2 → 0.0.3: 로컬 HTTP feed 확인,
  Ed25519 서명 ZIP 다운로드, 검증, 설치, 설치된 Info.plist 버전 교체까지 확인.
- 서명 후 ZIP 바이트를 변조한 테스트: 검증 오류로 설치를 차단하고 기존 0.0.2가 유지됨을 확인.
- UI는 테스트 데이터로 업데이트 가능 / 다운로드 중 / 설치 준비 완료 화면을 캡처했습니다.
- 앱 번들 외부 userData의 펫·설정 저장 방식을 유지합니다.
- 실제 GitHub 업로드 후 설치본 간 업데이트, 브라우저 quarantine이 붙은 최초 설치,
  Gatekeeper 재확인 여부와 접근성 권한 유지 여부는 아직 검증하지 않았습니다.

## 공식 자료

- https://sparkle-project.org/documentation/
- https://sparkle-project.org/documentation/programmatic-setup/
- https://github.com/sparkle-project/Sparkle/releases/tag/2.9.6
