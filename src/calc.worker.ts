// calc.worker.ts
self.onmessage = (event: MessageEvent) => {
    const { action, a, b } = event.data;

    if (action === 'sum') {
        // Симулируем вычисление
        const result = a + b;
        self.postMessage({ status: 'done', result });
    }
};
