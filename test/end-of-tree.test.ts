import { Spec, Dependency, Hook, HookType } from "../src";

export class EndOfTreeLayer1Test {
  data: any;

  @Spec()
  async start() {
    this.data = { somethingImportant: 1 };
  }

  @Hook(HookType.EndOfTree)
  async cleanUp() {
    this.data = null;
    console.log('layer 1 clean up completed!');
  }
}


export class EndOfTreeLayer2Test {
  data: any;

  @Dependency(EndOfTreeLayer1Test)
  previousLayer!: any;

  @Spec()
  async start() {
    this.data = { somethingImportant: 1 };
  }

  @Hook(HookType.EndOfTree)
  async cleanUp() {
    this.data = null;
    console.log('layer 2 clean up completed!');
  }
}


export class EndOfTreeLayer3Test {
  data: any;

  @Dependency(EndOfTreeLayer2Test)
  previousLayer!: any;

  @Spec()
  async start() {
    this.data = { somethingImportant: 1 };
  }

  @Hook(HookType.EndOfTree)
  async cleanUp() {
    this.data = null;
    console.log('layer 3 clean up completed!');
  }
}
