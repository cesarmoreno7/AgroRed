/** @type {import('jest').Config} */
module.exports = {
  displayName: "demand-service",
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  transform: {
    "^.+\\.ts$": ["babel-jest", { rootMode: "upward" }]
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  }
};
