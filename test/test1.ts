import { Spec, Dependency } from "../src";
import { ManualRun } from "../src/run";

class BasicTest {
  variable = 1;

  @Spec()
  async checkEqual() {
    await new Promise(resolve => { setTimeout(resolve, 1010) });
  }
}


class AnotherTest2 {
  @Spec() async check() {

  }
}


class AnotherTest {
  @Dependency(AnotherTest2)
  basicTest!: BasicTest;

  @Spec() async check() { }
  @Spec() async check2() { }
  @Spec() async check3() { }
  @Spec() async check4() { }
  @Spec() async check5() { await new Promise(resolve => { setTimeout(resolve, 1010) }); }
  @Spec() async check6() { }
  @Spec() async check7() { }
  @Spec() async check8() { }
}


ManualRun().catch(x => {
  process.exit(1);
});


