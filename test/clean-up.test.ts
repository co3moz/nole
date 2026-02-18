import { Test } from "../dist/index";

export class CleanUpLayer1Test extends Test() {
  data: any;

  async start() {
    this.data = { somethingImportant: 1 };
  }

  async cleanUp() {
    this.data = null;
    console.log("layer 1 clean up completed!");
  }
}

export class CleanUpLayer2Test extends Test({
  dependencies: {
    previousLayer: () => CleanUpLayer1Test,
  },
}) {
  data: any;

  async start() {
    this.data = { somethingImportant: 1 };
  }

  async cleanUp() {
    this.data = null;
    console.log("layer 2 clean up completed!");
  }
}

export class CleanUpLayer3Test extends Test({
  dependencies: {
    previousLayer: () => CleanUpLayer2Test,
  },
}) {
  data: any;

  async start() {
    this.data = { somethingImportant: 1 };
  }

  async cleanUp() {
    this.data = null;
    console.log("layer 3 clean up completed!");
  }
}
