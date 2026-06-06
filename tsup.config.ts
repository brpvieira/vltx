import { defineConfig, type Options } from 'tsup';

const shared = {
  target: 'node16',
  platform: 'node',
  sourcemap: true,
  esbuildOptions(options) {
    options.sourcesContent = false;
  },
  external: ['dotenv', 'yargs'],
  splitting: false,
  minify: false,
} satisfies Partial<Options>;

export default defineConfig([
  {
    ...shared,
    entry: ['src/index.ts', 'src/core/vltx.ts'],
    format: ['esm', 'cjs'],
    clean: true,
    dts: true,
  },
  {
    ...shared,
    entry: { 'bin/cli': 'src/bin/cli.ts' },
    format: ['esm'],
  },
]);
