import * as assert from "assert";
import { Spec } from "../index.js";
import { Executor } from "./executor.js";

export class ExecutorTest {
  @Spec()
  async evaluate() {
    await Executor(() => 1, 1);
    await Executor(async () => 1, 1);
  }

  @Spec()
  async throws() {
    await assert.rejects(() => {
      return Executor(() => {
        throw new Error("throws");
      }, 1);
    });
  }

  @Spec()
  async timeout() {
    await assert.rejects(() => {
      return Executor(() => new Promise(() => {}), 10);
    });
  }
}
