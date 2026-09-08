let activePort: MessagePort | null = null;

window.addEventListener("message", (event: MessageEvent) => {
    const port = event.ports[0];
    if (!port && !activePort) return;

    if (port) {
        activePort = port;

        activePort.onmessage = (msgEvent: MessageEvent) => {
            const data = msgEvent.data;
            console.log("[Iframe received message]:", data);

            if (data?.action === "sum") {
                activePort?.postMessage({
                    status: "success",
                    result: data.a + data.b,
                });
            }
        };
    }

    if (event.data?.action === "sum" && activePort) {
        activePort.postMessage({
            status: "success",
            result: event.data.a + event.data.b,
        });
    }
});
