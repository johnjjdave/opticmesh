import assert from "node:assert/strict";
import test from "node:test";
import { buildXmlValidations } from "../app/xml-validation.ts";

const slice = (name, screenName, output, warped = false) => ({ name, screenName, output, warped });

test("XML diagnostics identify exact duplicate, warped, and out-of-canvas slices", () => {
  const slices = [
    slice("Repeated", "Main", { x: 0, y: 0, width: 100, height: 100 }),
    slice("Repeated", "Aux", { x: 0, y: 0, width: 100, height: 100 }),
    slice("Warped Wall", "Main", { x: 100, y: 0, width: 100, height: 100 }, true),
    slice("Outside Wall", "Sim", { x: -12.5, y: 10, width: 120, height: 80 }),
  ];
  const messages = buildXmlValidations(slices, [
    { name: "Main", width: 500, height: 500, slices: slices.filter((item) => item.screenName === "Main") },
    { name: "Aux", width: 500, height: 500, slices: slices.filter((item) => item.screenName === "Aux") },
    { name: "Sim", width: 100, height: 100, slices: slices.filter((item) => item.screenName === "Sim") },
  ]);
  assert.match(messages.find((item) => item.text.includes("duplicate"))?.details || "", /Main \/ Repeated.*Aux \/ Repeated/);
  assert.match(messages.find((item) => item.text.includes("warped"))?.details || "", /Main \/ Warped Wall/);
  const outside = messages.find((item) => item.text.includes("outside canvas"));
  assert.equal(outside?.text, "Sim: 1 slice outside canvas");
  assert.match(outside?.details || "", /Sim \/ Outside Wall — x -12\.5, y 10, w 120, h 80/);
});

test("valid XML geometry exposes a descriptive passed state", () => {
  const valid = slice("Centre", "Main", { x: 0, y: 0, width: 100, height: 100 });
  assert.deepEqual(buildXmlValidations([valid], [{ name: "Main", width: 100, height: 100, slices: [valid] }]), [{
    level: "info",
    text: "Geometry checks passed",
    details: "No duplicate names, warped slices, or output rectangles outside their screen canvas were found.",
  }]);
});
