import { afterEach, describe, expect, it, vi } from "vitest";

import { createWorker, workerTransport } from "../../src/transports/worker";
import { FakeWorker, FakeWorkerGlobalScope } from "../helpers/fakes";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("workerTransport (main thread)", () => {
  it("posts payloads to the worker", () => {
    const worker = new FakeWorker();
    const transport = workerTransport<unknown>(worker as unknown as Worker);
    const payloads = [0, "", false, null, undefined, { type: "PING" }];

    for (const payload of payloads) {
      transport.send(payload);
    }

    expect(worker.messages).toEqual(payloads);
  });

  it("delivers worker messages to every handler", () => {
    const worker = new FakeWorker();
    const transport = workerTransport<string>(worker as unknown as Worker);
    const first = vi.fn<(data: string) => void>();
    const second = vi.fn<(data: string) => void>();

    transport.onMessage(first);
    transport.onMessage(second);
    worker.dispatchMessage("hello");

    expect(first).toHaveBeenCalledExactlyOnceWith("hello");
    expect(second).toHaveBeenCalledExactlyOnceWith("hello");
  });

  it("removes only the handler that was unsubscribed", () => {
    const worker = new FakeWorker();
    const transport = workerTransport<string>(worker as unknown as Worker);
    const first = vi.fn<(data: string) => void>();
    const second = vi.fn<(data: string) => void>();

    const unsubscribe = transport.onMessage(first);
    transport.onMessage(second);
    unsubscribe();
    worker.dispatchMessage("hello");

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith("hello");
    expect(worker.listeners.size).toBe(1);
  });

  it("stops delivering messages after unsubscribe", () => {
    const worker = new FakeWorker();
    const transport = workerTransport<string>(worker as unknown as Worker);
    const handler = vi.fn<(data: string) => void>();

    const unsubscribe = transport.onMessage(handler);
    unsubscribe();
    worker.dispatchMessage("ignored");

    expect(handler).not.toHaveBeenCalled();
    expect(worker.listeners.size).toBe(0);
  });

  it("terminates the worker", () => {
    const worker = new FakeWorker();
    const transport = workerTransport<string>(worker as unknown as Worker);

    transport.terminate?.();

    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});

describe("createWorker (worker context)", () => {
  it("posts payloads through the worker global scope", () => {
    const scope = new FakeWorkerGlobalScope();
    vi.stubGlobal("self", scope);
    const transport = createWorker<string>();
    const payloads = ["hello", "", "again"];

    for (const payload of payloads) {
      transport.send(payload);
    }

    expect(scope.messages).toEqual(payloads);
  });

  it("delivers messages from the worker global scope", () => {
    const scope = new FakeWorkerGlobalScope();
    vi.stubGlobal("self", scope);
    const transport = createWorker<string>();
    const handler = vi.fn<(data: string) => void>();

    transport.onMessage(handler);
    scope.dispatchMessage("hello");

    expect(handler).toHaveBeenCalledExactlyOnceWith("hello");
  });

  it("unsubscribes from the worker global scope", () => {
    const scope = new FakeWorkerGlobalScope();
    vi.stubGlobal("self", scope);
    const transport = createWorker<string>();
    const handler = vi.fn<(data: string) => void>();

    const unsubscribe = transport.onMessage(handler);
    unsubscribe();
    scope.dispatchMessage("ignored");

    expect(handler).not.toHaveBeenCalled();
    expect(scope.listeners.size).toBe(0);
  });

  it("closes the worker global scope on terminate", () => {
    const scope = new FakeWorkerGlobalScope();
    vi.stubGlobal("self", scope);
    const transport = createWorker<string>();

    transport.terminate?.();

    expect(scope.close).toHaveBeenCalledTimes(1);
  });
});
