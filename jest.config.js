/** Jest solo para lógica pura (sin React Native): cola de eventos y migración. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', target: 'es2020', strict: true, esModuleInterop: true, types: ['jest'] } }],
  },
};
