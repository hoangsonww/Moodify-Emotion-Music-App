module.exports = {
  testEnvironment: "jsdom",
  moduleFileExtensions: ["js", "jsx", "json", "node"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  // Let Babel ignore node_modules entirely now
  transformIgnorePatterns: ["<rootDir>/node_modules/"],
  moduleNameMapper: {
    // Map axios imports to our manual mock
    "^axios$": "<rootDir>/__mocks__/axios.js",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(jpg|jpeg|png|gif|webp|svg)$": "<rootDir>/__mocks__/fileMock.js",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testMatch: ["<rootDir>/src/**/__tests__/**/*.[jt]s?(x)"],
};
