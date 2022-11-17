import { strict as assert } from "assert";
import { Before, Spec, After, Hook, HookType, Dependents } from "../src/index.js";

// @After(() => [AlwaysExecuteFirst])
export class AlwaysExecuteLater {
  alwaysExecuteFirst: AlwaysExecuteFirst;

  @Spec()
  test() {
    assert(this.alwaysExecuteFirst.value === 1);
  }

  @Hook(HookType.CleanUp)
  cleanUp() {}
}

@Dependents(() => [AlwaysExecuteLater])
export class AlwaysExecuteFirst {
  value = 0;

  @Spec()
  test() {
    this.value = 1;
  }

  @Hook(HookType.CleanUp)
  cleanUp() {}
}

@After(() => [AlwaysExecuteFirst2])
export class AlwaysExecuteLater2 {
  alwaysExecuteFirst2: AlwaysExecuteFirst2;

  @Spec()
  test() {
    assert(this.alwaysExecuteFirst2.value === 1);
  }

  @Hook(HookType.CleanUp)
  cleanUp() {}
}

// @Before(() => [AlwaysExecuteLater2])
export class AlwaysExecuteFirst2 {
  value = 0;

  @Spec()
  test() {
    this.value = 1;
  }

  @Hook(HookType.CleanUp)
  cleanUp() {}
}
