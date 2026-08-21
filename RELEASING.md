# Releasing Codex Pet

Maintainer-only release notes. User-facing install and asset usage stay in `README.md`.

## Current Version

- App version: `v0.0.2`
- Source of truth: `electron/shared/release.ts` and `package.json`

## Build DMG

```bash
pnpm package:dmg
```

The command builds the app, creates a macOS DMG, computes SHA-256, and writes latest-version
metadata.

Expected outputs:

- `release/Codex-Pet-v0.0.2-darwin-arm64.dmg`
- `release/latest-darwin-arm64.json`

The manifest contains:

- `version`
- `fileName`
- `sha256`
- `size`
- `releaseDate`

Verify the hash before uploading:

```bash
shasum -a 256 release/Codex-Pet-v0.0.2-darwin-arm64.dmg
cat release/latest-darwin-arm64.json
```

The `shasum` value must match the manifest `sha256`.

## Signing And Notarization

Local packaging defaults to ad-hoc signing:

```bash
pnpm package:dmg
```

Public distribution needs Apple Developer ID signing and notarization. Required environment
variables:

- `CODEX_PET_CODESIGN_IDENTITY`: Developer ID Application identity name
- `CODEX_PET_NOTARIZE=1`: enables notarization
- App Store Connect API key path flow:
  - `CODEX_PET_NOTARY_KEY_PATH`
  - `CODEX_PET_NOTARY_KEY_ID`
  - `CODEX_PET_NOTARY_ISSUER_ID`
- Apple ID fallback flow:
  - `CODEX_PET_NOTARY_APPLE_ID`
  - `CODEX_PET_NOTARY_PASSWORD`
  - `CODEX_PET_NOTARY_TEAM_ID`

When `CODEX_PET_CODESIGN_IDENTITY` is set, `scripts/package-dmg.mjs` signs the app bundle with
hardened runtime and timestamps, signs the DMG, and verifies signatures. When
`CODEX_PET_NOTARIZE=1` is set, it submits the DMG through `xcrun notarytool`, staples the ticket,
and runs `spctl` assessment.

No Developer ID certificate is currently stored in this repository.

## GitHub Release Upload

Upload both files to the GitHub Release for the same version tag:

- DMG installer
- `latest-darwin-arm64.json`

The future update check can download the manifest, compare `version` against the current app
version, download the DMG when newer, and verify the downloaded file's SHA-256 against `sha256`.

Before building a public release, set the app update manifest URL in `electron/shared/release.ts`:

```ts
export const releaseUpdateConfig = {
  manifestUrl:
    "https://github.com/<owner>/<repo>/releases/latest/download/latest-darwin-arm64.json",
} as const;
```

For local testing, override it with `CODEX_PET_UPDATE_MANIFEST_URL`.

## GitHub Actions Release

The workflow is `.github/workflows/release.yml`.

Required repository secrets:

- `CODEX_PET_CERTIFICATE_BASE64`
- `CODEX_PET_CERTIFICATE_PASSWORD`
- `CODEX_PET_KEYCHAIN_PASSWORD`
- `CODEX_PET_CODESIGN_IDENTITY`
- `CODEX_PET_NOTARY_PRIVATE_KEY`
- `CODEX_PET_NOTARY_KEY_ID`
- `CODEX_PET_NOTARY_ISSUER_ID`

Manual release flow:

1. Create or push the release tag, for example `v0.0.2`.
2. Run the `Release DMG` workflow with the same tag.
3. Confirm the workflow uploads the DMG and `latest-darwin-arm64.json` to the GitHub Release.

The workflow assumes the GitHub Release already exists for the tag. If not, create the release
first or change the workflow to call `gh release create`.

## Auto Update Server

A dedicated server is not required for public GitHub Releases. The app can use GitHub-hosted release
assets or a static URL for the latest manifest.

A separate server or proxy becomes useful when:

- releases are private and the app should not embed GitHub credentials
- staged rollout or per-user eligibility is needed
- signed update metadata needs custom policy

For full automatic updates on macOS, plan for code signing, notarization, and updater metadata.

## Verification

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```
