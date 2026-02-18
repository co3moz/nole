import * as assert from "assert";
import { Test } from "../dist/index.js";

export class HookTest extends Test() {
  array: number[] = [1, 2, 3];

  async beforeEach() {
    this.array.push(4);
  }

  async afterEach() {
    assert.equal(this.array.length, 3);
  }

  async hasToBe4() {
    assert.equal(this.array.pop(), 4);
  }

  async skip_hasToBe4Again() {
    assert.equal(this.array.pop(), 4);
  }

  async hasToBe4AgainButNotSkipped() {
    assert.equal(this.array.pop(), 4);
  }
}
