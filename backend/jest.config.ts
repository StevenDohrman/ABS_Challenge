import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/__tests__/**",
    "!src/index.ts",
    "!src/server.ts",
    "!src/app.ts",
  ],
  // Map workspace package names to their compiled dist entries so jest can
  // resolve them the same way the TypeScript compiler does at build time.
  moduleNameMapper: {
    "^@abs/engine$": "<rootDir>/../engine/dist/index.js",
    "^@abs/data-pipeline$": "<rootDir>/../data-pipeline/dist/index.js",
  },
};

export default config;
