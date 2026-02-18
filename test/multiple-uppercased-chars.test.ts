import { strict as assert } from "assert";
import { Test } from "../dist/index";

export class IOTPOTest extends Test() {
  async test() {}
}

export class MultipleUppercasedCharsTest extends Test({
  dependencies: {
    IOTPOTest: () => IOTPOTest,
  },
}) {
  async check() {
    assert.notEqual(
      this["IOTPOTest"],
      undefined,
      "turkish character test is failed",
    );
  }
}
