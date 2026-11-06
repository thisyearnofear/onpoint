import { nextJsConfig } from "@repo/eslint-config/next-js";

const BANNED_CLASSES =
  "rounded-3xl|shadow-2xl|bg-gradient-to-|text-(emerald|amber|indigo|purple)-[0-9]";
const BANNED_MSG =
  "Design-system ban: use hairline borders, semantic tokens and solid colors (see plans/design-review + AGENTS.md).";

// Hand-rolled spinner signature: animate-spin + rounded-full + border in one
// class literal. Lucide icons spinning (Loader2 etc.) don't match — they have
// no border utilities. The one legal border-spinner lives in components/state.
const SPINNER_SIGNATURE =
  "(?=[\\s\\S]*animate-spin)(?=[\\s\\S]*rounded-full)(?=[\\s\\S]*border)";
const SPINNER_MSG =
  "Hand-rolled spinner banned — use <Spinner>, <Busy>, or <StagedWait> from components/state (see AGENTS.md state vocabulary).";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    files: ["app/**/*.{ts,tsx}"],
    ignores: ["app/admin/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=/${BANNED_CLASSES}/]`,
          message: BANNED_MSG,
        },
        {
          selector: `TemplateElement[value.raw=/${BANNED_CLASSES}/]`,
          message: BANNED_MSG,
        },
        {
          selector:
            'ImportDeclaration[source.value="lucide-react"] > ImportSpecifier[imported.name="Sparkles"]',
          message:
            "Sparkles is banned as decoration under app/ — pick a semantic icon or none.",
        },
        {
          selector: `Literal[value=/^${SPINNER_SIGNATURE}/]`,
          message: SPINNER_MSG,
        },
        {
          selector: `TemplateElement[value.raw=/^${SPINNER_SIGNATURE}/]`,
          message: SPINNER_MSG,
        },
      ],
    },
  },
  {
    files: ["components/**/*.{ts,tsx}"],
    ignores: ["components/state/**", "components/**/__tests__/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=/^${SPINNER_SIGNATURE}/]`,
          message: SPINNER_MSG,
        },
        {
          selector: `TemplateElement[value.raw=/^${SPINNER_SIGNATURE}/]`,
          message: SPINNER_MSG,
        },
      ],
    },
  },
];
