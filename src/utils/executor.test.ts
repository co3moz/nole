import * as assert from "assert";
import { Executor } from "./executor.js";
import { Test } from "../index.js";

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
}
