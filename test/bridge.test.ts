import { describe, expect, it, vi } from "vitest";

import { Bridge } from "../src/bridge";
import type { Transport } from "../src/transport";
import { createFakeTransport } from "./helpers/fakes";

describe("Bridge", () => {
  it("subscribes to the transport when constructed", () => {
    const fake = createFakeTransport<string>();

    new Bridge(fake.transport);

    expect(fake.handlerCount()).toBe(1);
  });

  it("delivers transport messages to every listener", () => {
    const fake = createFakeTransport<string>();
    const bridge = new Bridge(fake.transport);
    const first = vi.fn<(data: string) => void>();
    const second = vi.fn<(data: string) => void>();

    bridge.on(first);
    bridge.on(second);
    fake.receive("hello");

    expect(first).toHaveBeenCalledWith("hello");
    expect(second).toHaveBeenCalledWith("hello");
  });

  it("stops delivering messages after the on() unsubscribe is called", () => {
    const fake = createFakeTransport<string>();
    const bridge = new Bridge(fake.transport);
    const listener = vi.fn<(data: string) => void>();

    const unsubscribe = bridge.on(listener);
    unsubscribe();
    fake.receive("ignored");

    expect(listener).not.toHaveBeenCalled();
  });

  it("removes a listener with off()", () => {
    const fake = createFakeTransport<string>();
    const bridge = new Bridge(fake.transport);
    const listener = vi.fn<(data: string) => void>();

    bridge.on(listener);
    bridge.off(listener);
    fake.receive("ignored");

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not call a listener added during the current dispatch", () => {
    const fake = createFakeTransport<string>();
    const bridge = new Bridge(fake.transport);
    const late = vi.fn<(data: string) => void>();

    bridge.on(() => {
      bridge.on(late);
    });
    fake.receive("first");
    expect(late).not.toHaveBeenCalled();

    fake.receive("second");
    expect(late).toHaveBeenCalledExactlyOnceWith("second");
  });

  it("still calls a listener removed during the current dispatch", () => {
    const fake = createFakeTransport<string>();
    const bridge = new Bridge(fake.transport);
    const second = vi.fn<(data: string) => void>();

    bridge.on(() => bridge.off(second));
    bridge.on(second);

    fake.receive("first");
    expect(second).toHaveBeenCalledExactlyOnceWith("first");

    fake.receive("second");
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stores a duplicate listener only once", () => {
    const fake = createFakeTransport<string>();
    const bridge = new Bridge(fake.transport);
    const listener = vi.fn<(data: string) => void>();

    const unsubscribe = bridge.on(listener);
    bridge.on(listener);
    fake.receive("hello");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    fake.receive("again");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("sends emit() payloads through the transport without looping them back", () => {
    const fake = createFakeTransport<{ type: string }>();
    const bridge = new Bridge(fake.transport);
    const listener = vi.fn<(data: { type: string }) => void>();
    const payload = { type: "PING" };

    bridge.on(listener);
    bridge.emit(payload);

    expect(fake.send).toHaveBeenCalledExactlyOnceWith(payload);
    expect(listener).not.toHaveBeenCalled();
  });

  it("forwards payloads unchanged", () => {
    const fake = createFakeTransport<unknown>();
    const bridge = new Bridge<unknown>(fake.transport);
    const payloads = [0, "", false, null, undefined, { nested: ["value"] }];

    for (const payload of payloads) {
      bridge.emit(payload);
    }

    expect(fake.send.mock.calls.map(([payload]) => payload)).toEqual(payloads);
  });

  it("isolates errors thrown by listeners and keeps notifying the rest", () => {
    const fake = createFakeTransport<string>();
    const bridge = new Bridge(fake.transport);
    const error = new Error("listener failed");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi.fn<(data: string) => void>(() => {
      throw error;
    });
    const healthy = vi.fn<(data: string) => void>();

    bridge.on(failing);
    bridge.on(healthy);
    fake.receive("payload");

    expect(failing).toHaveBeenCalledWith("payload");
    expect(healthy).toHaveBeenCalledWith("payload");
    expect(errorSpy).toHaveBeenCalledExactlyOnceWith("[WebBridge] Error in listener:", error);
  });

  it("clears listeners, detaches from the transport and terminates on destroy()", () => {
    const fake = createFakeTransport<string>();
    const bridge = new Bridge(fake.transport);
    const listener = vi.fn<(data: string) => void>();

    bridge.on(listener);
    bridge.destroy();

    expect(fake.handlerCount()).toBe(0);
    expect(fake.terminate).toHaveBeenCalledTimes(1);

    fake.receive("ignored");
    expect(listener).not.toHaveBeenCalled();
  });

  it("is idempotent: destroy() twice cleans up once", () => {
    const fake = createFakeTransport<string>();
    const bridge = new Bridge(fake.transport);

    bridge.destroy();
    bridge.destroy();

    expect(fake.terminate).toHaveBeenCalledTimes(1);
  });

  it("works with transports that do not implement terminate()", () => {
    const send = vi.fn<(data: string) => void>();
    const transport: Transport<string> = {
      send,
      onMessage: () => () => {},
    };
    const bridge = new Bridge(transport);

    expect(() => bridge.destroy()).not.toThrow();
    expect(send).not.toHaveBeenCalled();
  });

  it("warns and ignores emit() after destroy()", () => {
    const fake = createFakeTransport<string>();
    const bridge = new Bridge(fake.transport);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    bridge.destroy();
    bridge.emit("ignored");

    expect(fake.send).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
      "[WebBridge] Cannot emit on a destroyed Bridge.",
    );
  });

  it("warns and returns a no-op unsubscribe from on() after destroy()", () => {
    const fake = createFakeTransport<string>();
    const bridge = new Bridge(fake.transport);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const listener = vi.fn<(data: string) => void>();

    bridge.destroy();
    const unsubscribe = bridge.on(listener);

    expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
      "[WebBridge] Cannot add a listener to a destroyed Bridge.",
    );
    expect(fake.handlerCount()).toBe(0);
    expect(() => unsubscribe()).not.toThrow();

    fake.receive("ignored");
    expect(listener).not.toHaveBeenCalled();
  });

  it("allows unsubscribing after destroy()", () => {
    const fake = createFakeTransport<string>();
    const bridge = new Bridge(fake.transport);
    const listener = vi.fn<(data: string) => void>();

    const unsubscribe = bridge.on(listener);
    bridge.destroy();

    expect(() => unsubscribe()).not.toThrow();
    expect(() => bridge.off(listener)).not.toThrow();
  });
});
