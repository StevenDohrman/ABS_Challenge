import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  cacheDirectory: "<rootDir>/../.cache/jest",
  coverageDirectory: "../coverage",
  collectCoverageFrom: ["**/*.ts", "!**/__tests__/**", "!**/index.ts"],
};

export default config;
