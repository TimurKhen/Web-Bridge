import { watch } from "fs";

async function buildAll() {
    const res = await Bun.build({
        entrypoints: [
            "./src/index.ts",
            "./src/second.ts",
            "./src/calc.worker.ts",
            "./src/iframe-worker.ts",
        ],
        outdir: "./dist",
        target: "browser",
        sourcemap: "inline",
    });
    if (!res.success) {
        console.error("Build failed:", res.logs);
    }
}

// Первичная сборка
await buildAll();

// Авто-пересборка при изменениях в src или lib
watch("./src", { recursive: true }, async () => {
    console.log("Change detected in src/, rebuilding...");
    await buildAll();
});
watch("./lib", { recursive: true }, async () => {
    console.log("Change detected in lib/, rebuilding...");
    await buildAll();
});

const server = Bun.serve({
    port: 3000,
    async fetch(req) {
        const url = new URL(req.url);
        let pathname = url.pathname;

        const filePath = `.${pathname}`;
        const file = Bun.file(filePath);

        if (await file.exists()) {
            return new Response(file);
        }

        return new Response("Not Found", { status: 404 });
    },
});

console.log(`Server running at http://localhost:${server.port}/second.html`);
