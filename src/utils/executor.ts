import { AsyncLocalStorage } from "async_hooks";

interface ExecutionScope {
  timeout: number;
  arm: ((ms: number) => void) | null;
}

// The ESM and the CommonJS build are separate module instances, so the scope
// has to live on a well known global for timeout() to work from either one.
const STORAGE_KEY = Symbol.for("nole.EXECUTION_STORAGE");

const globals = globalThis as any;

if (!globals[STORAGE_KEY]) {
  globals[STORAGE_KEY] = new AsyncLocalStorage<ExecutionScope>();
}

const storage: AsyncLocalStorage<ExecutionScope> = globals[STORAGE_KEY];

/**
 * Overrides the timeout of the spec or hook that is currently running. Counting
 * restarts from the moment of the call, which is what you want when the slow
 * part only becomes slow at runtime.
 */
export function setExecutionTimeout(ms: number) {
  const scope = storage.getStore();

  if (!scope) {
    throw new Error(
      "timeout() can only be called inside a spec or a hook of a running test",
    );
  }

  if (!(ms > 0)) {
    throw new Error(`timeout() needs a positive value, got ${ms}`);
  }

  scope.timeout = ms;
  scope.arm?.(ms);
}

export function Executor(fn: Function, timeout: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;
    let settled = false;

    const scope: ExecutionScope = { timeout, arm: null };

    function clear() {
      if (settled) return false;
      settled = true;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      return true;
    }

    function done() {
      if (clear()) resolve();
    }

    function fail(error: unknown) {
      if (clear()) reject(error);
    }

    storage.run(scope, () => {
      let value: any;

      try {
        value = fn();
      } catch (e) {
        fail(e);
        return;
      }

      // Only asynchronous work can be timed out; a synchronous spec has already
      // finished by the time we get here.
      if (value && typeof value.then === "function") {
        scope.arm = (ms: number) => {
          if (settled) return;
          if (timer) clearTimeout(timer);

          timer = setTimeout(() => {
            fail(new Error("Timeout occurred! value: " + ms));
          }, ms);
        };

        scope.arm(scope.timeout);

        value.then(done, fail);

        return;
      }

      done();
    });
  });
}
