const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

self.onmessage = async (event: MessageEvent) => {
    const data = event.data;
    const { action, a, b } = data;

    await delay(a * b)

    if (action === "sum") {
        self.postMessage({ status: "done", result: a + b });
    } else {
        console.warn("[Worker] Неизвестное действие:", action);
    }
};
