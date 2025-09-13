module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  verbose: true,
  forceExit: true,
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
};
