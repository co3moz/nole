import { strict as assert } from "assert";

import { Test } from "../dist/core.js";
import { getTest } from "../dist/index.js";

export class AlwaysExecuteLater extends Test({
  after: () => [AlwaysExecuteFirst],
}) {
  test() {
    const alwaysExecuteFirst = getTest(() => AlwaysExecuteFirst);
    assert(alwaysExecuteFirst.value === 1);
  }
}
export class AlwaysExecuteFirst extends Test() {
  value = 0;

  test() {
    this.value = 1;
  }
}

export class AlwaysExecuteLater2 extends Test({}) {
  test() {
    const alwaysExecuteFirst2 = getTest(() => AlwaysExecuteFirst2);
    assert(alwaysExecuteFirst2.value === 1);
  }

  cleanUp() {}
}

export class AlwaysExecuteFirst2 extends Test({
  before: () => [AlwaysExecuteLater2],
}) {
  value = 0;

  test() {
    this.value = 1;
  }

  cleanUp() {}
}
