import {describe, expect, it, vi} from "vitest";
import {Bridge} from "../src/bridge";
import {createFakeTransport} from "./helpers/fakes";

describe("Bridge – no memory leaks / proper cleanup", () => {
    it("releases the transport handler on destroy (handlerCount goes to 0)", () => {
        const fake = createFakeTransport<string>();
        const bridge = new Bridge(fake.transport);

        expect(fake.handlerCount()).toBe(1);

        bridge.destroy();
        expect(fake.handlerCount()).toBe(0);
    });

    it("does not retain listeners after destroy", () => {
        const fake = createFakeTransport<string>();
        const bridge = new Bridge(fake.transport);
        const listeners: Array<(d: string) => void> = [];

        for (let i = 0; i < 50; i++) {
            const fn = vi.fn();
            listeners.push(fn);
            bridge.on(fn);
        }

        bridge.destroy();

        fake.receive("should-not-arrive");
        for (const fn of listeners) {
            expect(fn).not.toHaveBeenCalled();
        }
    });

    it("survives many create / destroy cycles without accumulating handlers", () => {
        const fake = createFakeTransport<number>();

        for (let i = 0; i < 200; i++) {
            const bridge = new Bridge(fake.transport);
            const unsub = bridge.on(() => {
            });
            bridge.emit(i);
            unsub();
            bridge.destroy();
        }

        expect(fake.handlerCount()).toBe(0);
        expect(fake.terminate).toHaveBeenCalled();
    });

    it("unsubscribe from on() detaches without needing destroy", () => {
        const fake = createFakeTransport<string>();
        const bridge = new Bridge(fake.transport);
        const listener = vi.fn();

        const unsub = bridge.on(listener);
        expect(fake.handlerCount()).toBe(1);

        unsub();
        fake.receive("ignored");
        expect(listener).not.toHaveBeenCalled();


        expect(fake.handlerCount()).toBe(1);
        bridge.destroy();
        expect(fake.handlerCount()).toBe(0);
    });

    it("destroy is safe when listeners throw or when called multiple times", () => {
        const fake = createFakeTransport<string>();
        const bridge = new Bridge(fake.transport);

        bridge.on(() => {
            throw new Error("boom");
        });
        bridge.on(vi.fn());

        expect(() => {
            fake.receive("x");
            bridge.destroy();
            bridge.destroy();
        }).not.toThrow();

        expect(fake.handlerCount()).toBe(0);
        expect(fake.terminate).toHaveBeenCalledTimes(1);
    });

    it("after destroy, the Bridge no longer holds a live reference path through the transport", () => {
        const fake = createFakeTransport<object>();
        let bridge: Bridge<object> | null = new Bridge(fake.transport);

        const heavy = {payload: new Array(10_000).fill(0)};
        bridge.on(() => {
        });
        bridge.emit(heavy);

        bridge.destroy();
        bridge = null;


        expect(fake.handlerCount()).toBe(0);
    });
});
