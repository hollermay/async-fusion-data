const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');
const terser = require('@rollup/plugin-terser');
const json = require('@rollup/plugin-json'); // Add this

const isProduction = process.env.NODE_ENV === 'production';

// Shared TypeScript plugin configuration
const getTypescriptPlugin = (outDir) => typescript({
  tsconfig: './tsconfig.json',
  compilerOptions: {
    declaration: true,
    declarationDir: outDir,
    outDir: outDir,
    rootDir: './src',
  },
  noForceEmit: true,
});

module.exports = [
  // ESM build
  {
    input: 'src/index.ts',
    plugins: [
      json(), // Add this FIRST - handles JSON imports
      resolve(),
      commonjs(),
      getTypescriptPlugin('dist/esm'),
      !isProduction && terser(),
    ].filter(Boolean),
    output: {
      dir: 'dist/esm',
      format: 'esm',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].js',
    },
    external: ['kafkajs', 'react', 'react/jsx-runtime', 'ws', 'express', 'http', 'fs', 'path', 'events', 'stream', 'tty', 'util', 'os', 'child_process', 'crypto', 'url', 'querystring', 'zlib'],
  },
  // CJS build
  {
    input: 'src/index.ts',
    plugins: [
      json(), // Add this FIRST - handles JSON imports
      resolve(),
      commonjs(),
      getTypescriptPlugin('dist/cjs'),
      !isProduction && terser(),
    ].filter(Boolean),
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].js',
      exports: 'named',
    },
    external: ['kafkajs', 'react', 'react/jsx-runtime', 'ws', 'express', 'http', 'fs', 'path', 'events', 'stream', 'tty', 'util', 'os', 'child_process', 'crypto', 'url', 'querystring', 'zlib'],
  },
];