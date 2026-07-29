import type { Pool } from "pg";
import { triggerIratRecheck } from "./irat.js";

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("triggerIratRecheck (Bug #11)", () => {
  it("never throws synchronously even if the underlying sweep fails", async () => {
    const failingPool = {
      query: jest.fn().mockRejectedValue(new Error("connection refused"))
    } as unknown as Pool;

    expect(() => triggerIratRecheck(failingPool, "incident.registered")).not.toThrow();

    await flushMicrotasks();

    expect(failingPool.query).toHaveBeenCalled();
  });

  it("runs the composite sweep query against the provided pool", async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [] })
    } as unknown as Pool;

    triggerIratRecheck(pool, "demand.closed");

    await flushMicrotasks();

    expect(pool.query).toHaveBeenCalled();
  });
});
