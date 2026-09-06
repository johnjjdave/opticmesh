import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["desktop/**/*.cjs", "tests/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["app/**/*.{ts,tsx}"],
    ignores: ["app/reset-slider.tsx", "app/numeric-input.tsx"],
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "JSXOpeningElement[name.name='input'] JSXAttribute[name.name='type'][value.value='range']",
        message: "Use ResetSlider with an explicit resetValue so every slider supports double-click reset to its built-in default.",
      }, {
        selector: "JSXOpeningElement[name.name='input'] JSXAttribute[name.name='type'][value.value='number'], JSXOpeningElement[name.name='input'] JSXAttribute[name.name='inputMode'][value.value=/^(decimal|numeric)$/], JSXOpeningElement[name.name='input'] JSXAttribute[name.name=/^onWheel(Capture)?$/]",
        message: "Use NumericInput with onValueWheel so numeric editing cannot also scroll its panel.",
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "dist/**",
    ".release-web-*/**",
    "desktop/dist/**",
    "desktop/release*/**",
    "desktop/node_modules/**",
    "native/build/**",
    "native/addon/build/**",
    "work/**",
    "outputs/**",
    "design/**",
    "app/prototype/**",
  ]),
]);

export default eslintConfig;
