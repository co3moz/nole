import { Spec, Dependency, Hook, HookType } from "../src";

export class CleanUpLayer1Test {
  data: any;

  @Spec()
  async start() {
    this.data = { somethingImportant: 1 };
  }

  @Hook(HookType.CleanUp)
  async cleanUp() {
    this.data = null;
    console.log('layer 1 clean up completed!');
  }
}


export class CleanUpLayer2Test {
  data: any;

  @Dependency(CleanUpLayer1Test)
  previousLayer!: any;

  @Spec()
  async start() {
    this.data = { somethingImportant: 1 };
  }

  @Hook(HookType.CleanUp)
  async cleanUp() {
    this.data = null;
    console.log('layer 2 clean up completed!');
  }
}


export class CleanUpLayer3Test {
  data: any;

  @Dependency(CleanUpLayer2Test)
  previousLayer!: any;

  @Spec()
  async start() {
    this.data = { somethingImportant: 1 };
  }

  @Hook(HookType.CleanUp)
  async cleanUp() {
    this.data = null;
    console.log('layer 3 clean up completed!');
  }
}
