
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }],
  },
  moduleNameMapper: {
    '^@jpy/middleware/(.*)$': '<rootDir>/../packages/jpy-sdk/src/middleware/$1'
  }
};
