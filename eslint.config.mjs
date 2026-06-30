import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Relaxed rules for Firebase/Next patterns
  {
    rules: {
      // Firebase Firestore data is inherently dynamic (no static schema)
      "@typescript-eslint/no-explicit-any": "warn",
      // Firestore onSnapshot + setState is the standard pattern for real-time listeners
      "react-hooks/set-state-in-effect": "off",
      // <img> is acceptable for dynamic user/profile images where next/Image would need host config
      "@next/next/no-img-element": "warn",
      // Unescaped entities in static content pages are intentional
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;