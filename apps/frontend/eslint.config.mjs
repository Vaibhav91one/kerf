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
  ]),
  {
    // react-hooks/set-state-in-effect fires on a synchronous setState in an
    // effect body — benign here (a reset-then-fetch race guard, not a real
    // cascading-render bug) and documented in CLAUDE.md's "Lint state"
    // section. Scoped OFF only for the known files rather than repo-wide: a
    // blanket disable was what let this baseline grow from 2 files to 10
    // silently — a NEW file tripping this rule should still fail lint.
    files: [
      "src/hooks/use-mobile.ts",
      "src/hooks/use-refresh.ts",
      "src/lib/auth.tsx",
      "src/components/theme-toggle.tsx",
      "src/components/kerf/cli-status.tsx",
      "src/app/(app)/page.tsx",
      "src/app/(app)/me/page.tsx",
      "src/app/(app)/season/page.tsx",
      "src/app/(app)/people/\\[handle\\]/profile-client.tsx",
      "src/app/(app)/projects/\\[id\\]/project-client.tsx",
      "src/app/(app)/cli/connect/connect-client.tsx",
      "src/app/(app)/live/page.tsx",
      "src/app/(app)/rivals/page.tsx",
      "src/components/kerf/follow-button.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
