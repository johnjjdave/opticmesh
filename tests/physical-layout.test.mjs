import assert from "node:assert/strict";
import test from "node:test";
import { choosePhysicalLayoutAnchor, commonSelectionValue, resolvePhysicalLayout } from "../app/physical-layout.ts";

const rect = (id, x, y, width, height) => ({ id, x, y, width, height });
const bounds = (slice, position, pitch) => ({
  left: position[0] - slice.width * pitch / 2000,
  right: position[0] + slice.width * pitch / 2000,
  bottom: position[1],
  top: position[1] + slice.height * pitch / 1000,
});

test("uniform pitch retains spacing while the anchor stays fixed", () => {
  const slices = [rect("a", 0, 0, 100, 50), rect("b", 120, 0, 100, 50)];
  const positions = resolvePhysicalLayout(slices, 220, 50, { a: 4, b: 4 }, {}, 4, "a");
  assert.deepEqual(positions.a, [0, 0, 0]);
  assert.deepEqual(positions.b, [0.48, 0, 0]);
});

test("mixed pitches do not introduce overlap between separated slices", () => {
  const slices = [rect("small", 0, 0, 100, 100), rect("large", 100, 0, 100, 100)];
  const pitches = { small: 2.9, large: 4.8 };
  const positions = resolvePhysicalLayout(slices, 200, 100, pitches, {}, 2.0833);
  const small = bounds(slices[0], positions.small, pitches.small);
  const large = bounds(slices[1], positions.large, pitches.large);
  assert.ok(small.right <= large.left + Number.EPSILON);
});

test("a pitch change immediately changes physical placement", () => {
  const slices = [rect("a", 0, 0, 100, 100), rect("b", 100, 0, 100, 100)];
  const before = resolvePhysicalLayout(slices, 200, 100, { a: 2.9, b: 2.9 }, {}, 2.9, "a");
  const after = resolvePhysicalLayout(slices, 200, 100, { a: 4.8, b: 2.9 }, {}, 2.9, "a");
  assert.deepEqual(after.a, before.a);
  assert.notDeepEqual(after.b, before.b);
});

test("automatic anchor chooses the central screen and keeps it at X zero", () => {
  const slices = [rect("left", 0, 100, 100, 100), rect("centre", 100, 0, 200, 300), rect("right", 300, 100, 100, 100)];
  assert.equal(choosePhysicalLayoutAnchor(slices, 400, 300), "centre");
  const positions = resolvePhysicalLayout(slices, 400, 300, { left: 2.37, centre: 3.1415, right: 6.25 }, {}, 4.4444);
  assert.ok(Math.abs(positions.centre[0]) < 1e-12);
});

test("arbitrary positive custom pitches are accepted and remain overlap-safe", () => {
  const slices = [rect("custom-a", 0, 0, 137, 83), rect("custom-b", 137, 0, 211, 83)];
  const pitches = { "custom-a": 2.37, "custom-b": 6.25 };
  const positions = resolvePhysicalLayout(slices, 348, 83, pitches, {}, 4.4444, "custom-a");
  const first = bounds(slices[0], positions["custom-a"], pitches["custom-a"]);
  const second = bounds(slices[1], positions["custom-b"], pitches["custom-b"]);
  assert.ok(first.right <= second.left + Number.EPSILON);
});

test("selection values distinguish common and mixed state", () => {
  assert.equal(commonSelectionValue([4.8, 4.8, 4.8]), 4.8);
  assert.equal(commonSelectionValue([2.9, 3.9, 4.8]), null);
});

test("all nine pivot anchors resolve to the matching physical point", () => {
  const slice = rect("screen", 0, 0, 100, 50);
  const pitch = 4;
  const bottomLeft = resolvePhysicalLayout([slice], 100, 50, { screen: pitch }, { screen: "bottom-left" }, pitch, "screen").screen;
  const centre = resolvePhysicalLayout([slice], 100, 50, { screen: pitch }, { screen: "center" }, pitch, "screen").screen;
  const topRight = resolvePhysicalLayout([slice], 100, 50, { screen: pitch }, { screen: "top-right" }, pitch, "screen").screen;
  assert.deepEqual(bottomLeft, [-0.2, 0, 0]);
  assert.deepEqual(centre, [0, 0.1, 0]);
  assert.deepEqual(topRight, [0.2, 0.2, 0]);
});
