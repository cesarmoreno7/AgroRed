/** @type {import('jest').Config} */
module.exports = {
  displayName: "integration",
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": ["babel-jest", { rootMode: "upward" }]
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  testMatch: ["<rootDir>/**/*.test.ts"]
};
