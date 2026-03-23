import { config } from "@repo/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    rules: {
      // Disable prop-types — TypeScript handles type safety
      "react/prop-types": "off",
    },
  },
];
