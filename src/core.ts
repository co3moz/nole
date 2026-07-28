import { TEST_CLASS_KEY, TEST_INSTANCE_INFO } from "./symbol.js";
import type { TestWrap } from "./test-wrap.js";

export interface TestClassInfo {
  dependencies?: Map<string, () => new () => BaseTest>;
  skip?: string;
  before?: () => Array<new () => BaseTest>;
  after?: () => Array<new () => BaseTest>;
  timeout?: number;
  /** how many extra attempts a failing spec of this class gets */
  retries?: number;
  /** run this class on its own, even when --concurrency is higher than one */
  exclusive?: boolean;
}

export class BaseTest {
  [TEST_INSTANCE_INFO]!: TestWrap;

  static [TEST_CLASS_KEY]: TestClassInfo = {
    dependencies: new Map(),
    timeout: 5000,
  };
}

type DependencyDefinitionRule<T extends BaseTest> = () => new () => T;
type InferDependencyDefinition<T> = T extends () => infer U ? U : never;

export function Test<
  Deps extends Record<string, DependencyDefinitionRule<any>> = {},
>({
  dependencies,
  skip,
  before,
  after,
  timeout,
  retries,
  exclusive,
}: {
  dependencies?: Deps;
  skip?: string;
  before?: () => Array<new () => BaseTest>;
  after?: () => Array<new () => BaseTest>;
  timeout?: number;
  retries?: number;
  exclusive?: boolean;
} = {}) {
  type Props = {
    [K in keyof Deps]: InstanceType<InferDependencyDefinition<Deps[K]>>;
  };

  function wrap(superClassInfo: TestClassInfo): TestClassInfo {
    const deps = dependencies ? dependencies : ({} as Deps);

    const classInfo = { ...superClassInfo };

    if (!classInfo.dependencies) {
      classInfo.dependencies = new Map();
    } else {
      classInfo.dependencies = new Map(classInfo.dependencies);
    }

    if (before !== undefined) {
      classInfo.before = before;
    }

    if (after !== undefined) {
      classInfo.after = after;
    }

    for (const key of Object.keys(deps)) {
      const config = deps[key];

      if (TEST_CLASS_KEY in config) {
        classInfo.dependencies.set(key, (() => config) as any);
      } else if (typeof config === "function") {
        classInfo.dependencies.set(key, config);
      } else {
        throw new Error(`Invalid dependency configuration for key ${key}`);
      }
    }

    if (skip !== undefined) {
      classInfo.skip = skip;
    }

    if (timeout !== undefined) {
      classInfo.timeout = timeout;
    }

    if (retries !== undefined) {
      classInfo.retries = retries;
    }

    if (exclusive !== undefined) {
      classInfo.exclusive = exclusive;
    }

    return classInfo;
  }

  return class extends BaseTest {
    static [TEST_CLASS_KEY]: TestClassInfo = wrap(super[TEST_CLASS_KEY]);

    constructor() {
      super();
    }
  } as unknown as new () => Props & BaseTest;
}
