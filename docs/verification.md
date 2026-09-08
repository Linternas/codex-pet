# v0.0.2 배포 준비 검증

2026-09-08, macOS ARM64.

- pnpm typecheck, pnpm test (18 files / 74 tests), pnpm lint, pnpm build 통과.
- 임시 UI 플래그 파일과 분기 제거. 실제 npx·업데이트 상태로 동작.
- 최종 Electron UI: 캐릭터 클릭 시 설정 창 열리지 않음, 상태바에서 열림, 권한 미허용 알림→허용 시 해제, Node 설치 확인 취소 시 설치 미실행 검증.
- 최소 창 너비 860px에서 가로 넘침 없음.
- Node 공식 LTS curl 다운로드→SHA256 검증→임시 폴더 설치→npx 실행 검증 완료. 기존 시스템 Node 변경 없음.
- 별도 네이티브 테스트 앱에서 Sparkle 0.0.2→0.0.3 실제 교체 확인. 변조 ZIP 차단 및 기존 버전 유지 확인.
- 투명 PNG와 런타임 PNG의 alpha0–255 확인. 앱 아이콘 ICNS 재생성.
- 최종 앱 ad-hoc codesign 검증, 업데이트 feed 서명 검증 통과. appcast ZIP URL·크기 일치 확인.

## 배포 파일

release/에 다음 파일을 준비했습니다. 파일은 Git 커밋에서 제외됩니다.

- Codex-Pet-v0.0.2-darwin-arm64.dmg
- Codex-Pet-v0.0.2-darwin-arm64.zip
- appcast.xml
- latest-darwin-arm64.json
- SHA256SUMS.txt
- release-notes-v0.0.2.md

GitHub 게시와 push/tag는 수행하지 않았습니다. v0.0.2 안정 릴리스에 첨부할 파일과 절차는
[업데이트 배포 문서](github-release-updates.md)를 참고하세요.

## 검증 범위

실제 GitHub feed를 통한 전체 Codex Pet 설치본 업데이트, 브라우저 quarantine이 붙은 최초 설치,
Gatekeeper 재승인 및 접근성 권한 유지 여부는 배포 후 확인이 필요합니다.
스크린샷의 v0.0.3은 화면 테스트 데이터입니다.
