import { Spec, Dependency } from "../src";

class BasicTest {
  variable = 1;

  @Spec()
  async checkEqual() {
    await new Promise(resolve => { setTimeout(resolve, 1010) });
  }
}

class DependencyTest {
  @Dependency(BasicTest)
  basicTest!: BasicTest;

  @Spec() async check() { }
}

