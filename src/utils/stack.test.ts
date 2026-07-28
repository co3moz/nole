import * as assert from "assert";
import { Test } from "../index.js";
import { cleanStack, errorHeadline, formatError, renderDiff } from "./stack.js";

export class StackTest extends Test() {
  dropsNoleFrames() {
    const stack = [
      "Error: kaboom",
      "    at QueueTest.push (/home/me/project/test/queue.test.ts:9:11)",
      `    at Executor (${process.cwd()}/dist/utils/executor.js:2:12)`,
      `    at handleSpecs (${process.cwd()}/src/handle/specs.ts:16:23)`,
      "    at new Promise (<anonymous>)",
      "    at async Module.run (node:internal/modules/run_main:123:5)",
    ].join("\n");

    const cleaned = cleanStack(stack).split("\n");

    assert.equal(cleaned[0], "Error: kaboom");
    assert.equal(cleaned.length, 2, cleaned.join("\n"));
    assert.ok(cleaned[1].includes("queue.test.ts"));
  }

  keepsNoleOwnTestFiles() {
    // nole's own *.test.ts files are user code as far as a report goes
    const frame = `    at PipelineTest.run (${process.cwd()}/src/pipeline.test.ts:10:3)`;
    const cleaned = cleanStack(`Error: x\n${frame}`);

    assert.ok(cleaned.includes("pipeline.test.ts"));
  }

  keepsTheStackWhenNothingIsLeft() {
    const stack = `Error: x\n    at Executor (${process.cwd()}/src/utils/executor.ts:2:12)`;

    assert.equal(cleanStack(stack), stack);
  }

  diff() {
    const rendered = renderDiff({ a: 1, b: 2 }, { a: 1, b: 3 });

    assert.ok(rendered.includes("expected"));
    assert.ok(rendered.includes("actual"));

    // a multi line value keeps the lines that match unmarked
    const long = renderDiff([1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 9]);

    assert.ok(long.split("\n").some((line) => line.startsWith("  ")));
  }

  formatsAssertionErrors() {
    let error: any;

    try {
      assert.equal(1, 2);
    } catch (e) {
      error = e;
    }

    const formatted = formatError(error, ">>");

    assert.ok(formatted.startsWith(">>"), "every line is indented");
    assert.ok(formatted.includes("expected"));
  }

  formatsUnknownThrows() {
    assert.ok(formatError("just a string").includes("just a string"));
    assert.equal(errorHeadline("just a string"), "just a string");
    assert.equal(errorHeadline(new Error("boom")), "Error: boom");
    assert.equal(
      errorHeadline(new Error("boom\nand details")),
      "Error: boom",
      "only the first line is used while streaming",
    );
  }
}
