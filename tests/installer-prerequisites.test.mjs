import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("packages a verified official NDI Runtime prerequisite", async () => {
  const [desktopPackage, prepareScript, installerScript, readme, manual, page] = await Promise.all([
    readFile(new URL("../desktop/package.json", import.meta.url), "utf8"),
    readFile(new URL("../desktop/scripts/prepare-ndi-runtime.mjs", import.meta.url), "utf8"),
    readFile(new URL("../desktop/build/installer.nsh", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../app/manual-content.md", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(desktopPackage, /"prepare:ndi": "node scripts\/prepare-ndi-runtime\.mjs"/);
  assert.match(desktopPackage, /"include": "build\/installer\.nsh"/);
  assert.match(prepareScript, /https:\/\/ndi\.link\/NDIRedistV6/);
  assert.match(prepareScript, /7EE73EEDB56402BCA5100868353DBAB4E944B6C37D2D9881580698A3B61346CD/);
  assert.match(prepareScript, /official NDI Runtime changed/);
  assert.match(installerScript, /NDI_RUNTIME_DIR_V6/);
  assert.match(installerScript, /NDI_RUNTIME_DIR_V5/);
  assert.match(installerScript, /NDI 6 Runtime\\v6\\Processing\.NDI\.Lib\.x64\.dll/);
  assert.match(installerScript, /ExecWait.*ndi-runtime\.exe.*\/NORESTART/);
  assert.match(installerScript, /NDI Runtime installer did not complete/);
  assert.match(readme, /NDI® is a registered trademark of Vizrt NDI AB/);
  assert.match(manual, /official NDI 6 Runtime prerequisite installer/);
  assert.match(page, /NDI® technology by Vizrt · ndi\.video/);
});
