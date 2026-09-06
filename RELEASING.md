# Release process

Release notes describe the final behavior available to users. Maintain the changelog during development, then consolidate duplicate and superseded entries before publication. Exclude personal projects, internal discussions, benchmark results, feature inspirations, and unimplemented proposals.

## Prepare a release

1. Compare the candidate against the previous published tag.
2. Confirm root and desktop package versions agree. Keep the Beta label when applicable; the Git tag uses the numeric version, for example `v0.7.0`.
3. Update the dated changelog section, README, Manual, native README, platform requirements, compatibility notes, and license notices. Do not invent release dates, checksums, signing status, or download availability.
4. Check the tracked-file list. Exclude credentials, local projects, planning notes, design studies, screenshots from internal reviews, dependencies, and generated release folders. Preserve source code, regression fixtures, required assets, build instructions, and third-party licenses.
5. Run `pnpm test`, `pnpm lint`, the desktop renderer build, browser interaction checks, and relevant native checks.
6. Open a pull request and wait for all required checks. The Windows workflow produces an NSIS installer and a matching web ZIP; source-validation failures must be resolved before merging.

## Build and verify

The Windows build uses:

```sh
pnpm install --frozen-lockfile
pnpm --dir desktop install --frozen-lockfile
pnpm exec vite build --config desktop/vite.config.ts
pnpm --dir desktop build --publish never
```

The build retrieves the official NDI Runtime from `https://ndi.link/NDIRedistV6`, verifies its pinned SHA-256, and includes it through `desktop/build/installer.nsh`. If the upstream hash changes, inspect the vendor release and signature before updating the pin.

Verify installation and application launch in an isolated environment. Check the bundled Manual, desktop saving/recovery, export dialogs, native bridge, and changed interactions. Exercise clean installation and upgrade paths where available; record coverage and any limitations in internal release evidence, separate from user release notes. Never use personal recovery files as test fixtures.

The package must include original OpticMesh, font, Spout, and renderer dependency notices. Check final artifact hashes, names, embedded version, and signing status.

## Publish

1. Merge the reviewed pull request after required checks pass.
2. Create the version tag from the merged commit and a draft GitHub release.
3. Dispatch **Windows release** with the draft tag as `release_tag`. The workflow builds that exact tag, stores the web ZIP and its verification manifest on the `codex/web-assets` deployment-storage branch, and attaches only the installer and its `SHA256SUMS.txt` to the public release. It refuses to replace an already published release.
4. Download and verify the actual attached artifacts. Use the complete version section from CHANGELOG.md as release notes.
5. Publish as GitHub **Latest** when this is the recommended public download, even if the app remains labelled Beta. Use prerelease status only for a secondary preview.
6. Dispatch **Deploy website** on `main` after publication. The Pages environment permits deployments from `main`; release-tag events cannot deploy directly. The workflow selects the Latest release, reads its ZIP from `codex/web-assets/releases/<tag>/`, and verifies the manifest's tag, source commit, filename, size, and SHA-256 before deployment. Source previews are never substituted for release artifacts.

Web packages remain on the deployment-storage branch without CI artifact expiry. Keep that branch available for deployments and rollback. A retry reuses a verified archive for the same tag and source commit; corrupt archives or changed tag targets fail verification. The branch is public repository infrastructure, not private storage. The separate `OpticMesh-Web` Actions artifact is a temporary convenience copy, not the website's deployment dependency.

## Post-publication repository review

Before announcing the release, verify:

- the Latest release, installer name, checksums, source tag, and README download link;
- the hosted app version, HTTPS domain, and its match to the Windows release;
- every public README and Manual link, feature list, known limitation, and license notice;
- repository description, homepage, topics, social preview, issue links, and enabled community features;
- absence of private project data, internal discussions, generated binaries outside release assets, and unused template files;
- the desktop update endpoint detects the new version and points to the correct release.

Retain previous releases for compatibility and recovery unless a separate removal decision is made. Do not rewrite release history or remove required third-party notices as part of routine cleanup.

