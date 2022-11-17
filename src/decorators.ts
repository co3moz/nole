import { HashMap } from "./data.js";
import { Test, HookType, ClassDefition } from "./test.js";
import camelcase from "camelcase";

/**
 * Assignes method as test case
 * @param timeout Timeout of case in milliseconds
 */
export function Spec(timeout: number = 5000): MethodDecorator {
  return function (target, propertyKey) {
    DeclareSpecForTestClass(target, <string>propertyKey, timeout);
  };
}

/**
 * Assignes dependency for test class
 * @param dependency a Test class that needed
 */
export function Dependency<T>(dependency: ClassDefition<T>): PropertyDecorator {
  return function (target, propertyKey) {
    DeclareDependencyForTestClass(target, <string>propertyKey, dependency);
  };
}

/**
 * Assignes dependencies for test class
 * @param dependencies a Test class array that needed
 */
export function Dependencies(
  dependencies: (() => ClassDefition<any>[]) | ClassDefition<any>[]
): ClassDecorator {
  return function (target) {
    setImmediate(() => {
      const value = isFunction(dependencies) ? dependencies() : dependencies;

      for (const dependency of value) {
        const propertyKey = validPropertyName(dependency.name);

        DeclareDependencyForTestClass(
          { constructor: target },
          propertyKey,
          dependency
        );
      }
    });
  };
}

/**
 * Reverse dependencies for assuring execution order
 * @param dependents a function that returns a Test class array
 */
export function Dependents(
  dependents: (() => ClassDefition<any>[]) | ClassDefition<any>[]
): ClassDecorator {
  return function (target) {
    setImmediate(() => {
      const value = isFunction(dependents) ? dependents() : dependents;

      for (const dependent of value) {
        const propertyKey = validPropertyName(target.name);

        DeclareDependencyForTestClass(
          { constructor: dependent },
          propertyKey,
          target
        );
      }
    });
  };
}

/**
 * Creates hook for test case
 * @param type Hook type
 * @param timeout Timeout of case in milliseconds
 */
export function Hook(type: HookType, timeout: number = 5000): MethodDecorator {
  return function (target, propertyKey) {
    DeclareHookForTestClass(target, <string>propertyKey, type, timeout);
  };
}

/**
 * Assigns test spec as skipped
 * @param reason Why skipped
 */
export function Skip(reason?: string): MethodDecorator {
  return function (target, propertyKey) {
    DeclareAsSkipped(target, <string>propertyKey, reason ? reason : "");
  };
}

/**
 * Assigns test spec as skipped
 * @param reason Why skipped
 */
export function SkipClass(reason?: string): ClassDecorator {
  return function (target) {
    DeclareAsSkippedClass(target, reason ? reason : "");
  };
}

function GetTestInstanceOfTarget(target: any) {
  let instance = HashMap().get(target);
  if (!instance) {
    HashMap().set(target, (instance = new Test(target)));
  }
  return instance;
}

function DeclareDependencyForTestClass(
  protoOfTarget: any,
  propertyKey: string,
  dependency: any
) {
  const target = protoOfTarget.constructor;

  const test = GetTestInstanceOfTarget(target);
  const depTest = GetTestInstanceOfTarget(dependency);

  test.dependencies.push({ propertyKey, dependency: depTest });
  depTest.dependents.push(test);
}

function DeclareSpecForTestClass(
  protoOfTarget: any,
  propertyKey: string,
  timeout: number
) {
  const target = protoOfTarget.constructor;
  const test = GetTestInstanceOfTarget(target);

  if (test.hooks.has(propertyKey)) {
    throw new Error("@Hook cannot be used with @Spec! Test: ");
  }

  if (test.specs.has(propertyKey)) {
    throw new Error("Multiple @Spec for a single method is prohibited");
  }

  test.specs.set(propertyKey, { timeout });
}

function DeclareHookForTestClass(
  protoOfTarget: any,
  propertyKey: string,
  hookType: HookType,
  timeout: number
) {
  const target = protoOfTarget.constructor;
  const test = GetTestInstanceOfTarget(target);

  if (test.specs.has(propertyKey)) {
    throw new Error("@Hook cannot be used with @Spec");
  }

  if (test.hooks.has(propertyKey)) {
    throw new Error("Multiple @Hook for a single method is prohibited");
  }

  test.hooks.set(propertyKey, { type: hookType, timeout });
}

function DeclareAsSkipped(
  protoOfTarget: any,
  propertyKey: string,
  reason: string
) {
  const target = protoOfTarget.constructor;
  const test = GetTestInstanceOfTarget(target);

  if (test.skip.has(propertyKey)) {
    const obj = test.skip.get(propertyKey)!;

    if (reason) {
      obj.reason = (obj.reason ? obj.reason + ", " : "") + reason;
    }
  } else {
    test.skip.set(propertyKey, { reason });
  }
}

function DeclareAsSkippedClass(target: any, reason: string) {
  const test = GetTestInstanceOfTarget(target);

  test.skipClass = { reason };
}

function validPropertyName(name: string) {
  return camelcase(name, {
    preserveConsecutiveUppercase:
      process.env.NOLE_PRESERVE_CONSECUTIVE_UPPERCASE == undefined
        ? true
        : process.env.NOLE_PRESERVE_CONSECUTIVE_UPPERCASE === "true",

    pascalCase:
      process.env.NOLE_PASCALCASE == undefined
        ? false
        : process.env.NOLE_PASCALCASE === "true",

    locale: "en-US",
  });
}

function isFunction(thing: any): thing is (...args: any[]) => void {
  return typeof thing !== "object" && typeof thing === "function";
}
