/** @type {import('jest').Config} */
module.exports = {
  displayName: "automation-service",
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": ["babel-jest", { rootMode: "upward" }]
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  }
};