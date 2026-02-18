import * as assert from "assert";
import { Test } from "../dist/index.js";

class Simple extends Test() {
  variable = 1;

  async before() {
    console.log("before", this.variable);
    assert.equal(this.variable, 1);
  }

  async after() {
    console.log("after", this.variable);
    assert.equal(this.variable, 2);
  }

  async change() {
    this.variable = 2;
  }
}

class ExtendedSimple extends Simple {
  async change() {
    this.variable = 3;
  }

  async after() {
    console.log("after", this.variable);
    assert.equal(this.variable, 3);
  }
}

export class ExtendedTest extends Test({
  dependencies: {
    simple: () => Simple,
    extendedSimple: () => ExtendedSimple,
  },
}) {
  async check() {
    assert.equal(this.simple.variable, 2);
    assert.equal(this.extendedSimple.variable, 3);
  }
}
