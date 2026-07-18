import { BaseTest, type TestClassInfo } from "./core.js";
import { TEST_CLASS_KEY } from "./symbol.js";

export interface IDependency {
  propertyKey: string;
  dependency: TestWrap;
}

export interface ISpec {}

export interface IHook {
  type: HookType;
}

export interface ISkip {
  reason: string;
  origin?: string;
}

// Old code, but works fine, so I won't change it for now
export class TestWrap {
  dependencies: IDependency[] = [];
  dependents: TestWrap[] = [];
  skip = new Map<string, ISkip>();
  skipClass: ISkip | null = null;
  specs = new Map<string, ISpec>();
  hooks = new Map<string, IHook>();
  isFinished: boolean = false; // cleanup ignored
  cleanUpCalled: boolean = false;
  testInstance: any;
  specDetection: boolean = false;
  config: TestClassInfo;

  constructor(public target: new () => BaseTest) {
    this.config = target[TEST_CLASS_KEY];
  }

  get name() {
    return this.target.name;
  }
}

export enum HookType {
  Before, // Trigger when test case is ready to handle
  After, // Trigger when test case did all the specs
  BeforeEach, // Trigger before each spec
  AfterEach, // Trigger after each spec
  CleanUp, // Trigger after all dependents tested (You can safely remove connections etc.)
}
