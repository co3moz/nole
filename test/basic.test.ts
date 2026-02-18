import { Test } from "../dist/index.js";

class BasicTest extends Test({ timeout: 750 }) {
  variable = 1;

  async checkEqual() {
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }
}

export class DependencyTest extends Test({
  dependencies: {
    basicTest: () => BasicTest,
  },
}) {
  async check() {
    if (this.basicTest.variable !== 1) {
      throw new Error("Dependency test failed!");
    }
  }
}
