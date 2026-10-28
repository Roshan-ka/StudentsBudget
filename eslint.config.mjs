import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scratch work of the review workflow (throwaway specs, screenshots): not part of the app.
    ".superpowers/**",
    // Agent worktrees are full checkouts with their own node_modules: not part of this one.
    ".claude/worktrees/**",
    // Playwright's output: failed tests keep traces, and the HTML report bundles the trace viewer's scripts.
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
  ]),
  {
    rules: {
      // `crypto.randomUUID` is missing on a plain-HTTP address (a phone opening the PC's LAN address), and it throws there.
      "no-restricted-properties": [
        "error",
        {
          object: "crypto",
          property: "randomUUID",
          message: "Use newId() from @/lib/new-id: randomUUID only exists on HTTPS and localhost.",
        },
      ],
    },
  },
  {
    // The scripts run in Node, not in the browser.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
]);

export default eslintConfig;
