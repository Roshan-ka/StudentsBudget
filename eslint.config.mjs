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
    // Text a person reads comes from the dictionaries (src/i18n/messages), so every language has it. An area joins
    // this list once its text has moved there (docs/superpowers/plans/2026-11-02-language-switch.md). Props are not
    // checked (class names): a translated aria-label is the reviewer's to see.
    files: [
      "src/features/home/**/*.tsx",
      "src/features/entries/**/*.tsx",
      "src/app/entries/**/*.tsx",
      "src/features/setup/**/*.tsx",
      "src/app/setup/**/*.tsx",
      "src/features/profile/**/*.tsx",
      "src/features/recurring/**/*.tsx",
      "src/features/accounts/**/*.tsx",
      "src/features/backup/**/*.tsx",
      "src/features/account/**/*.tsx",
      "src/features/check-in/**/*.tsx",
      "src/features/charts/**/*.tsx",
      "src/features/badges/**/*.tsx",
      "src/features/reveal/**/*.tsx",
      "src/features/tips/**/*.tsx",
      "src/features/discounts/**/*.tsx",
      "src/features/swaps/**/*.tsx",
      "src/components/date-field.tsx",
    ],
    rules: {
      // The dot between translated parts, and the arrows beside Previous and Next, read the same in every language.
      "react/jsx-no-literals": ["error", { noStrings: true, ignoreProps: true, allowedStrings: ["·", "‹", "›"] }],
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
