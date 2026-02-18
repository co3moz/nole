import { strict as assert } from "assert";
import { Test } from "../dist/index";

export class ICharacterTest extends Test() {
  async test() {}
}

export class TurkishCharacterTest extends Test({
  dependencies: {
    iCharacterTest: () => ICharacterTest,
  },
}) {
  async check() {
    assert.notEqual(
      this["iCharacterTest"],
      undefined,
      "turkish character test is failed",
    );
  }
}
