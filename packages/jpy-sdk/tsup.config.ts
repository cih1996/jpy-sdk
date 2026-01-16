import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'middleware/index': 'src/middleware/index.ts',
    'admin-device/index': 'src/admin-device/index.ts',
    'admin-dhcp/index': 'src/admin-dhcp/index.ts',
    'device-modify/index': 'src/device-modify/index.ts',
    'shared/index': 'src/shared/index.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  outDir: 'dist',
  external: ['msgpackr']
});
