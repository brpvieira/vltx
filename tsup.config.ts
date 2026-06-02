import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/bin/cli.ts'
  ],
  format: ['esm', 'cjs'],
  target: 'node16',
  platform: 'node',
  clean: true,
  sourcemap: true,
  external: ['dotenv'],
  splitting: false,
  minify: false,
  dts: true
});
