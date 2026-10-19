import { describe, expect, it } from "vitest";

import * as api from "../src/index";

describe("public entry point", () => {
  it("exports the documented runtime API", () => {
    expect(Object.keys(api)).toEqual(
      expect.arrayContaining([
        "Bridge",
        "messagePort",
        "acceptMessagePort",
        "workerTransport",
        "createWorker",
        "broadcast",
      ]),
    );

    expect(api.Bridge).toBeTypeOf("function");
    expect(api.messagePort).toBeTypeOf("function");
    expect(api.acceptMessagePort).toBeTypeOf("function");
    expect(api.workerTransport).toBeTypeOf("function");
    expect(api.createWorker).toBeTypeOf("function");
    expect(api.broadcast).toBeTypeOf("function");
  });
});
