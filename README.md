# OpticMesh web deployment storage

This branch retains versioned web application packages for automated deployment and rollback. Use [opticmesh.lo2s.com](https://opticmesh.lo2s.com/) to run the hosted application, or the repository's Releases page for the Windows installer.

Each `releases/<tag>/` directory contains the exact web ZIP and a manifest with its release tag, source commit, filename, byte count, and SHA-256. The website workflow verifies that manifest before deployment. Release packages are retained here independently of temporary Actions artifact expiry.

The Windows release workflow adds packages to this branch. Existing packages are reused for the same source commit, never silently overwritten. Keep this branch available for future deployments and rollback. It contains public deployment assets, not secrets or user projects.
