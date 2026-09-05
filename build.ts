await Bun.build({
    entrypoints: ['./src/index.ts', './src/second.ts'],
    outdir: './dist',
});
