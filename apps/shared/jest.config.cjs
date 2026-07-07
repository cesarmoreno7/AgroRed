/** @type {import('jest').Config} */
module.exports = {
  displayName: "shared",
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  testMatch: ["<rootDir>/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": ["babel-jest", { rootMode: "upward" }]
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  }
};
