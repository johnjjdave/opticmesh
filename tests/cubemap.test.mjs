import assert from "node:assert/strict";
import test from "node:test";
import {
  CUBEMAP_FACE_ORDER,
  cubemapAtlasDimensions,
  cubemapFaceCenterDirection,
  cubemapFacePlacements,
  cubemapFaceUvToDirection,
  directionFromAzimuthElevation,
  directionToCubemapFaceUv,
} from "../app/cubemap.ts";

const close = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);

test("face resolution remains invariant between atlas layouts", () => {
  assert.deepEqual(cubemapAtlasDimensions(2048, "three-by-two"), { width: 6144, height: 4096, face: 2048 });
  assert.deepEqual(cubemapAtlasDimensions(2048, "horizontal-cross"), { width: 8192, height: 6144, face: 2048 });
  assert.deepEqual(cubemapAtlasDimensions(2048, "vertical-cross"), { width: 6144, height: 8192, face: 2048 });
});

test("cross atlas face resolution is constrained to the supported 1K–4K range", () => {
  assert.equal(cubemapAtlasDimensions(256, "horizontal-cross").face, 1024);
  assert.equal(cubemapAtlasDimensions(512, "vertical-cross").face, 1024);
  assert.equal(cubemapAtlasDimensions(8192, "horizontal-cross").face, 4096);
});

test("all layouts contain every OpenGL face exactly once", () => {
  for (const layout of ["three-by-two", "horizontal-cross", "vertical-cross"]) {
    const placements = cubemapFacePlacements(layout);
    assert.deepEqual(placements.map((face) => face.key), CUBEMAP_FACE_ORDER);
    assert.equal(new Set(placements.map((face) => `${face.x}:${face.y}`)).size, 6);
  }
});

test("OpenGL face mapping round-trips representative UV coordinates", () => {
  for (const face of CUBEMAP_FACE_ORDER) for (const [u, v] of [[0, 0], [-.75, -.4], [.2, .8]]) {
    const projected = directionToCubemapFaceUv(cubemapFaceUvToDirection(face, u, v));
    assert.equal(projected.face, face);
    close(projected.u, u);
    close(projected.v, v);
  }
});

test("OpticMesh cardinal directions follow the declared OpenGL convention", () => {
  assert.equal(directionToCubemapFaceUv(directionFromAzimuthElevation(0, 0)).face, "+Z");
  assert.equal(directionToCubemapFaceUv(directionFromAzimuthElevation(90, 0)).face, "+X");
  assert.equal(directionToCubemapFaceUv(directionFromAzimuthElevation(180, 0)).face, "-Z");
  assert.equal(directionToCubemapFaceUv(directionFromAzimuthElevation(270, 0)).face, "-X");
  assert.equal(directionToCubemapFaceUv(directionFromAzimuthElevation(0, 90)).face, "+Y");
  assert.equal(directionToCubemapFaceUv(directionFromAzimuthElevation(0, -90)).face, "-Y");
});

test("cross layouts label positive Z as the front face", () => {
  const faces = cubemapFacePlacements("horizontal-cross");
  assert.equal(faces.find((face) => face.key === "+Z")?.name, "FRONT");
  assert.equal(faces.find((face) => face.key === "-Z")?.name, "BACK");
  assert.deepEqual(faces.find((face) => face.key === "+Z"), { key: "+Z", name: "FRONT", x: 1, y: 1 });
});

test("face centres point along their matching cube axes", () => {
  const expected = { "+X": [1, 0, 0], "-X": [-1, 0, 0], "+Y": [0, 1, 0], "-Y": [0, -1, 0], "+Z": [0, 0, 1], "-Z": [0, 0, -1] };
  for (const face of CUBEMAP_FACE_ORDER) Object.values(cubemapFaceCenterDirection(face)).forEach((value, index) => close(value, expected[face][index]));
});

test("horizontal-cross shared edges represent identical directions", () => {
  const samples = [-1, -.5, 0, .5, 1];
  for (const u of samples) {
    const backTop = cubemapFaceUvToDirection("+Z", u, -1);
    const topBottom = cubemapFaceUvToDirection("+Y", u, 1);
    close(backTop.x, topBottom.x); close(backTop.y, topBottom.y); close(backTop.z, topBottom.z);
    const backBottom = cubemapFaceUvToDirection("+Z", u, 1);
    const bottomTop = cubemapFaceUvToDirection("-Y", u, -1);
    close(backBottom.x, bottomTop.x); close(backBottom.y, bottomTop.y); close(backBottom.z, bottomTop.z);
  }
});
