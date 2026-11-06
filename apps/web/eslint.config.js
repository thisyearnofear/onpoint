import { nextJsConfig } from "@repo/eslint-config/next-js";

const BANNED_CLASSES =
  "rounded-3xl|shadow-2xl|bg-gradient-to-|text-(emerald|amber|indigo|purple)-[0-9]";
const BANNED_MSG =
  "Design-system ban: use hairline borders, semantic tokens and solid colors (see plans/design-review + AGENTS.md).";

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
      ],
    },
  },
];
