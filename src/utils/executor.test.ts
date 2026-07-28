import * as assert from "assert";
import { Executor, setExecutionTimeout } from "./executor.js";
import { Test, timeout } from "../index.js";

// Captured while this module is being imported, which is the only moment we
// can be sure no spec or hook is executing.
let outsideOfARun: unknown;

try {
  timeout(10);
} catch (e) {
  outsideOfARun = e;
}

export class ExecutorTest extends Test() {
  async evaluate() {
    await Executor(() => 1, 1);
    await Executor(async () => 1, 1);
  }

  async throws() {
    await assert.rejects(() => {
      return Executor(() => {
        throw new Error("throws");
      }, 1);
    });
  }

  async timeout() {
    await assert.rejects(() => {
      return Executor(() => new Promise(() => {}), 10);
    });
  }

  async timeoutCanBeExtendedAtRuntime() {
    await Executor(async () => {
      setExecutionTimeout(200);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }, 10);
  }

  async timeoutCanBeShortened() {
    await assert.rejects(
      () =>
        Executor(async () => {
          setExecutionTimeout(5);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }, 60_000),
      /Timeout occurred! value: 5/,
    );
  }

  timeoutOutsideARunIsAnError() {
    assert.match(
      String((outsideOfARun as Error)?.message),
      /only be called inside a spec/,
    );
  }

  async timeoutNeedsAPositiveValue() {
    await assert.rejects(
      () => Executor(async () => setExecutionTimeout(0), 100),
      /positive value/,
    );
  }
}
