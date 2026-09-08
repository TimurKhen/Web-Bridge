await Bun.build({
    entrypoints: [
        "./src/index.ts",
        "./src/second.ts",
        "./src/calc.worker.ts",
        "./src/iframe-worker.ts",
    ],
    outdir: "./dist",
    target: "browser",
    splitting: false,
    sourcemap: "inline",
});

console.log("Build complete!");
