const { build } = require('esbuild');

build({
  entryPoints: ['src/index.js'],
  bundle: true,
  minify: true,
  platform: 'node',
  outfile: 'dist/cdd.bundle.js',
  sourcemap: true,
  external: ['dockerode', 'ink'], 
}).catch(() => process.exit(1));
