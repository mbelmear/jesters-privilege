import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  // Unit tests live in tests/unit, apart from the code they test (docs/testing.md).
  testMatch: ["<rootDir>/tests/unit/**/*.test.{ts,tsx}"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts"],
  // Logic modules live in src/lib and must stay well covered. Components are
  // covered by their own tests and by Playwright, so they carry no threshold.
  coverageThreshold: {
    global: {},
    "./src/lib/": { lines: 90 },
  },
};

// Exported this way so next/jest can load the async Next config.
export default createJestConfig(config);
