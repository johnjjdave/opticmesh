# Release process

Release notes describe the final behavior available to users. Maintain the changelog during development, then consolidate duplicate and superseded entries before publication. Exclude personal projects, internal discussions, benchmark results, feature inspirations, and unimplemented proposals.

## Prepare a release

1. Compare the candidate against the previous published tag.
2. Confirm root and desktop package versions agree. Keep the Beta label when applicable; the Git tag uses the numeric version, for example `v0.7.0`.
3. Update the dated changelog section, README, Manual, native README, platform requirements, compatibility notes, and license notices. Do not invent release dates, checksums, signing status, or download availability.
4. Check the tracked-file list. Exclude credentials, local projects, planning notes, design studies, screenshots from internal reviews, dependencies, and generated release folders. Preserve source code, regression fixtures, required assets, build instructions, and third-party licenses.
5. Run `pnpm test`, `pnpm lint`, the desktop renderer build, browser interaction checks, and relevant native checks.
6. Open a pull request and wait for all required checks. The Windows workflow produces an NSIS installer and checksum; source-validation failures must be resolved before merging.

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
3. Dispatch **Windows release** with the draft tag as `release_tag`. The workflow builds that exact tag and attaches the installer and its `SHA256SUMS.txt` to the public release. It refuses to replace an already published release.
4. Download and verify the actual attached artifacts. Use the complete version section from CHANGELOG.md as release notes.
5. Publish as GitHub **Latest** when this is the recommended public download, even if the app remains labelled Beta. Use prerelease status only for a secondary preview.
6. Web support ends at v0.7.0. Do not deploy desktop release builds to the website. **Deploy website** is manual-only for deployment; it verifies the archived v0.7.0 package on `codex/web-assets`. Retain that archive for rollback.

## Replacing an existing beta installer

When an in-place beta update is explicitly authorized, retain the release tag and version number. Build and verify the replacement locally, merge its source and documentation after required checks, then replace the existing installer and checksum assets with `gh release upload --clobber`. Update the existing release notes with the source commit and replacement date so users can distinguish builds of the same version. Keep the original tag intact; the notes identify the updated installer source. Do not create a new release or dispatch the draft-only publishing workflow for this operation.

## Post-publication repository review

Before announcing the release, verify:

- the Latest release, installer name, checksums, source tag, and README download link;
- the hosted app remains at its final supported v0.7.0 release;
- every public README and Manual link, feature list, known limitation, and license notice;
- repository description, homepage, topics, social preview, issue links, and enabled community features;
- absence of private project data, internal discussions, generated binaries outside release assets, and unused template files;
- the desktop update endpoint detects the new version and points to the correct release.

Retain previous releases for compatibility and recovery unless a separate removal decision is made. Do not rewrite release history or remove required third-party notices as part of routine cleanup.

