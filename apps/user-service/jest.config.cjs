/** @type {import('jest').Config} */
module.exports = {
  displayName: "user-service",
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": ["babel-jest", { rootMode: "upward" }]
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  }
};
