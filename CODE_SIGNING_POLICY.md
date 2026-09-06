# Release provenance and privacy

## Release provenance

LO2S - OpticMesh is published from the [official source repository](https://github.com/johnjjdave/opticmesh). Release source is identified by its Git tag, and Windows downloads include a SHA-256 checksum file.

Current Windows releases are unsigned. A checksum verifies that a download matches the published file; it is not a code-signing certificate. No third-party signing sponsorship is claimed.

Release changes pass through a pull request and the repository’s required checks before publication. Download artifacts from the official [GitHub Releases](https://github.com/johnjjdave/opticmesh/releases) page.

## Local files and network access

OpticMesh processes project files, imported Resolume XML, logos, patterns, and scene geometry locally. It does not upload project content to an LO2S server.

The Windows application creates managed startup and recovery files under Documents\OpticMesh, restores the last working state, and can watch a linked Resolume preset when that feature is enabled. Named project saves and exports use the selected destinations.

Desktop update checks contact GitHub for release information. Opening external documentation or download links uses the system browser. NDI input/output exchanges video frames over the network when enabled; Spout exchanges frames between applications on the same Windows computer. Video-device access requires the relevant permission.

The hosted application is delivered over HTTPS and processes maps and images in the browser. Its hosting provider receives ordinary web requests. Browser project saving is manual.
