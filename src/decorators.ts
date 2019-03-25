import { HashMap } from "./data";
import { Test, HookType, ClassDefition } from "./test";

/**
 * Assignes method as test case
 * @param timeout Timeout of case in milliseconds
 */
export function Spec(timeout: number = 5000): MethodDecorator {
  return function (target, propertyKey) {
    DeclareSpecForTestClass(target, <string>propertyKey, timeout);
  }
}


/**
 * Assignes dependency for test class
 * @param dependency a Test class that needed
 */
export function Dependency<T>(dependency: ClassDefition<T>): PropertyDecorator {
  return function (target, propertyKey) {
    DeclareDependencyForTestClass(target, <string>propertyKey, dependency);
  }
}


/**
 * Creates hook for test case
 * @param type Hook type
 * @param timeout Timeout of case in milliseconds
 */
export function Hook(type: HookType, timeout: number = 5000): MethodDecorator {
  return function (target, propertyKey) {
    DeclareHookForTestClass(target, <string>propertyKey, type, timeout);
  }
}


/**
 * Assigns test spec as skipped
 * @param reason Why skipped
 */
export function Skip(reason?: string): MethodDecorator {
  return function (target, propertyKey) {
    DeclareAsSkipped(target, <string>propertyKey, reason ? reason : '');
  }
}




function GetTestInstanceOfTarget(target: any) {
  let instance = HashMap().get(target);
  if (!instance) {
    HashMap().set(target, instance = new Test(target));
  }
  return instance;
}


function DeclareDependencyForTestClass<T>(protoOfTarget: T, propertyKey: string, dependency: any) {
  let target = protoOfTarget.constructor;

  let test = GetTestInstanceOfTarget(target);
  let depTest = GetTestInstanceOfTarget(dependency);

  test.dependencies.push({ propertyKey, dependency: depTest });
}


function DeclareSpecForTestClass<T>(protoOfTarget: T, propertyKey: string, timeout: number) {
  let target = protoOfTarget.constructor;
  let test = GetTestInstanceOfTarget(target);

  if (test.hooks.has(propertyKey)) {
    throw new Error('@Hook cannot be used with @Spec! Test: ');
  }

  if (test.specs.has(propertyKey)) {
    throw new Error('Multiple @Spec for a single method is prohibited');
  }

  test.specs.set(propertyKey, { timeout });
}

function DeclareHookForTestClass<T>(protoOfTarget: T, propertyKey: string, hookType: HookType, timeout: number) {
  let target = protoOfTarget.constructor;
  let test = GetTestInstanceOfTarget(target);

  if (test.specs.has(propertyKey)) {
    throw new Error('@Hook cannot be used with @Spec');
  }

  if (test.hooks.has(propertyKey)) {
    throw new Error('Multiple @Hook for a single method is prohibited');
  }

  test.hooks.set(propertyKey, { type: hookType, timeout });
}

function DeclareAsSkipped<T>(protoOfTarget: T, propertyKey: string, reason: string) {
  let target = protoOfTarget.constructor;
  let test = GetTestInstanceOfTarget(target);

  if (test.skip.has(propertyKey)) {
    let obj = test.skip.get(propertyKey)!;

    if (reason) {
      obj.reason = (obj.reason ? obj.reason + ', ' : '') + reason;
    }
  } else {
    test.skip.set(propertyKey, { reason });
  }
}