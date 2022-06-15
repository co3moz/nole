import { Spec, Dependency } from "../src/index.js";

export class BasicTest {
  variable = 1;

  @Spec()
  async checkEqual() {
    await new Promise(resolve => { setTimeout(resolve, 1010) });
  }
}

export class DependencyTest {
  @Dependency(BasicTest)
  basicTest!: BasicTest;

  @Spec() async check() {
    if (this.basicTest.variable !== 1) throw new Error('Dependency test failed!');
  }
}

