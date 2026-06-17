# Codex Pet Mac

현재 앱 버전은 `v0.0.1`입니다.

macOS 전용 Electron 앱입니다. `npx codex-pets add <pet-id>`로 받은 pet asset을
프로젝트 안의 `public/pets/<pet-id>`에 저장하고, 투명한 데스크톱 오버레이 창에
캐릭터를 표시합니다.

캐릭터 목록과 pet id는 [codex-pets.net](https://codex-pets.net/)에서 확인할 수 있습니다.
앱에서 pet id를 입력하면 내부적으로 `npx --yes codex-pets add <pet-id>`를 실행해 에셋을
다운로드합니다.

## npx 확인

앱은 에셋 추가 전에 `npx -v`로 `npx`가 있는지 확인합니다. `npx`가 없으면 pet id 입력과
추가 버튼이 비활성화됩니다.

`npx`는 Node.js에 포함되어 있습니다. macOS에 Node.js가 없다면 아래 순서로 설치합니다.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node
```

설치 후 앱을 다시 실행하면 `npx -v` 확인을 다시 수행합니다.

## 앱 아이콘

앱 아이콘은 pet 에셋 경로(`public/pets`)와 별도로 관리됩니다.  
`scripts/build-app-icon.mjs`는 프로젝트 루트의 `image1.png` 또는 `image1.jpg`를 읽어
`build/Codex-Pet.icns`를 생성하고, DMG 패키징 시 이 파일을 앱 번들에 반영합니다.

권장 입력 파일:
- 정사각형 PNG/JPG(가능하면 1024x1024)
- 아이콘 배경을 투명하게 하려면 **PNG(알파 채널 필요)**
- 파일명: `image1.png`(우선), `image1.jpg`
- 위치: 레포지토리 루트

`iconutil` 변환은 환경에 따라 실패할 수 있어 실패 시 수동 `.icns` 생성으로 대체합니다.
앱 실행 시 `build/Codex-Pet.png`가 있으면 macOS 상단바 아이콘에도 사용합니다.

## 에셋 추가

1. [codex-pets.net](https://codex-pets.net/)에서 사용할 pet id를 확인합니다.
2. 관리자 창의 입력창에 pet id를 입력합니다.
3. 추가 버튼을 누르면 앱이 `npx --yes codex-pets add <pet-id>`를 실행합니다.
4. 다운로드된 에셋은 `public/pets/<pet-id>`에 저장되고, 적용 버튼으로 화면에 표시합니다.

## 기능

- 추가: 관리자 창에서 pet id를 입력하면 `npx --yes codex-pets add <pet-id>`를 실행하고
  `public/pets/<pet-id>`로 복사합니다.
- 삭제: 프로젝트에 저장된 `public/pets/<pet-id>` 복사본만 삭제합니다.
- 적용: 선택한 pet을 투명 오버레이 창에 표시합니다.
- 이동: 오버레이 캐릭터 영역을 드래그해서 위치를 옮깁니다.
- 애니메이션: spritesheet의 9개 행을 idle/run/waving/jumping/running/review 상태로
  매핑하고, 투명하지 않은 프레임만 순환합니다.
- 크기 조정: 기본 65%, 최대 100%입니다. 관리자 창의 크기 슬라이더나 오버레이 우하단
  핸들로 조정합니다.
- 오버레이 핸들: 마우스를 올렸을 때만 우하단 resize 핸들이 보입니다.
- 앱 전환: 오버레이는 포커스를 가져가지 않고 manager window가 앱 전환 대상이 되도록
  처리합니다.
- OS 전체 키보드 입력: macOS Accessibility 권한을 받은 뒤 native key monitor가
  `keyDown`을 감지해 waving 상태로 전환합니다.

## 손쉬운 사용 권한

OS 전체 키보드 입력 감지는 macOS 손쉬운 사용 권한이 있어야 동작합니다.

권한 요청 대상 이름은 `Codex Pet Keyboard Monitor`입니다. 시스템 설정에서 아래 경로로 이동해
허용합니다.

```text
System Settings > Privacy & Security > Accessibility
```

`pnpm start`로 실행하는 개발 모드에서도 키보드 감지를 위해
`dist-native/Codex Pet Keyboard Monitor.app` 번들을 생성합니다. 권한 목록에 자동으로 보이지
않으면 위 경로에서 직접 추가합니다.

## 저장 경로

- Codex CLI 설치 원본: `~/.codex/pets/<pet-id>`
- 프로젝트 저장본: `public/pets/<pet-id>`
- 화면 표시 이미지: `public/pets/<pet-id>/spritesheet.webp`

## 로컬 개발 실행

```bash
pnpm install
pnpm import:guga
pnpm start
```

`pnpm start`를 실행하면 관리자 창과 캐릭터 오버레이 창이 함께 열립니다.

개발 프리뷰는 `pnpm dev:app`으로 확인합니다.
