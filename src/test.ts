export interface IDependency {
  propertyKey: string
  dependency: Test
}

export interface ISpec {
  timeout: number
}

export interface IHook {
  type: HookType
  timeout: number
}

export interface ISkip {
  reason: string
}

export class Test {
  dependencies: IDependency[] = [];
  dependents: Test[] = [];
  skip = new Map<string, ISkip>();
  skipClass: ISkip | null = null;
  specs = new Map<string, ISpec>();
  hooks = new Map<string, IHook>();
  isFinished: boolean;
  cleanUpCalled: boolean = false;
  testInstance: any;

  constructor(public target: any) {
    this.isFinished = false;
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
  CleanUp // Trigger after all dependents tested (You can safely remove connections etc.)
}

export interface ClassDefition<T> { new(): T; }