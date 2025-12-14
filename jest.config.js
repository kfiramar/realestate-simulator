module.exports = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    roots: ['<rootDir>/tests'],
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    transformIgnorePatterns: []
};
