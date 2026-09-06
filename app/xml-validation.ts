export type XmlValidationSlice = {
  name: string;
  screenName: string;
  warped: boolean;
  output: { x: number; y: number; width: number; height: number };
};

export type XmlValidationScreen = {
  name: string;
  width: number;
  height: number;
  slices: XmlValidationSlice[];
};

export type XmlValidationItem = { level: "warn" | "info"; text: string; details: string };

const practical = (value: number) => Number(value.toFixed(2));

export function buildXmlValidations(allSlices: XmlValidationSlice[], screens: XmlValidationScreen[]): XmlValidationItem[] {
  const messages: XmlValidationItem[] = [], slicesByName = new Map<string, XmlValidationSlice[]>();
  allSlices.forEach((slice) => slicesByName.set(slice.name, [...(slicesByName.get(slice.name) || []), slice]));
  const duplicates = Array.from(slicesByName.entries()).filter(([, slices]) => slices.length > 1);
  if (duplicates.length) messages.push({
    level: "warn",
    text: `${duplicates.length} duplicate slice name${duplicates.length > 1 ? "s" : ""}`,
    details: duplicates.map(([name, slices]) => `“${name}”: ${slices.map((slice) => `${slice.screenName} / ${slice.name}`).join(", ")}`).join("\n"),
  });

  const warped = allSlices.filter((slice) => slice.warped);
  if (warped.length) messages.push({
    level: "warn",
    text: `${warped.length} warped slice${warped.length > 1 ? "s" : ""} need advanced geometry`,
    details: `Advanced geometry required:\n${warped.map((slice) => `${slice.screenName} / ${slice.name}`).join("\n")}`,
  });

  screens.forEach((screen) => {
    const outside = screen.slices.filter((slice) => slice.output.x < 0 || slice.output.y < 0 || slice.output.x + slice.output.width > screen.width + 0.1 || slice.output.y + slice.output.height > screen.height + 0.1);
    if (!outside.length) return;
    messages.push({
      level: "warn",
      text: `${screen.name}: ${outside.length} slice${outside.length > 1 ? "s" : ""} outside canvas`,
      details: `Outside ${screen.width} × ${screen.height} output canvas:\n${outside.map((slice) => `${slice.screenName} / ${slice.name} — x ${practical(slice.output.x)}, y ${practical(slice.output.y)}, w ${practical(slice.output.width)}, h ${practical(slice.output.height)}`).join("\n")}`,
    });
  });

  if (!messages.length) messages.push({ level: "info", text: "Geometry checks passed", details: "No duplicate names, warped slices, or output rectangles outside their screen canvas were found." });
  return messages;
}
