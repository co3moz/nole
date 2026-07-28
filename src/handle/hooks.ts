import { HookType, TestWrap } from "../test-wrap.js";
import { Executor } from "../utils/executor.js";
import { TimeDifference } from "../utils/time_difference.js";
import { DEFAULT_TIMEOUT } from "../const.js";
import {
  enterLocation,
  exitLocation,
  recordHook,
  type RunContext,
} from "../context.js";

const CANONICAL: Record<HookType, string> = {
  [HookType.Before]: "before",
  [HookType.After]: "after",
  [HookType.BeforeEach]: "beforeEach",
  [HookType.AfterEach]: "afterEach",
  [HookType.CleanUp]: "cleanUp",
};

/** "QueueTest:before" or "QueueTest.hookInit:before" for named hooks. */
export function hookLabel(
  test: TestWrap,
  propertyKey: string,
  type: HookType,
): string {
  const canonical = CANONICAL[type];

  return propertyKey === canonical
    ? `${test.name}:${canonical}`
    : `${test.name}.${propertyKey}:${canonical}`;
}

export function resolveTimeout(test: TestWrap, ctx: RunContext): number {
  return ctx.options.timeout ?? test.config.timeout ?? DEFAULT_TIMEOUT;
}

export type HookOutcome = "ok" | "failed" | "skipped";

/**
 * Runs every hook of one kind. Unlike the old behaviour a failure no longer
 * tears the whole process down: it is recorded and the caller decides what to
 * do with the class.
 */
export async function runHooks(
  test: TestWrap,
  ctx: RunContext,
  type: HookType,
): Promise<HookOutcome> {
  const timeout = resolveTimeout(test, ctx);
  let outcome: HookOutcome = "ok";

  for (const [propertyKey, hook] of test.hooks.entries()) {
    if (hook.type != type) continue;

    const hookName = hookLabel(test, propertyKey, type);
    const start = TimeDifference.begin();

    enterLocation(hookName);

    try {
      await Executor(
        test.testInstance[propertyKey].bind(test.testInstance),
        timeout,
      );

      recordHook(ctx, {
        className: test.name,
        hookName,
        type,
        status: "ok",
        duration: start.end(),
        timeout,
      });
    } catch (e) {
      const anchor = (e as any)?._nole_anchor;
      const duration = start.end();

      if (anchor === 1) {
        // skipTest() inside a hook is always a mistake, hooks are not specs
        recordHook(ctx, {
          className: test.name,
          hookName,
          type,
          status: "failed",
          duration,
          timeout,
          error: new Error(
            "You cannot just skip a hook! Probably you meant to skip the whole test class with skipClass().",
          ),
        });

        return "failed";
      }

      if (anchor === 2) {
        if (type !== HookType.Before && type !== HookType.BeforeEach) {
          recordHook(ctx, {
            className: test.name,
            hookName,
            type,
            status: "failed",
            duration,
            timeout,
            error: new Error(
              `skipClass() cannot be used in a ${CANONICAL[type]} hook, the class has already run.`,
            ),
          });

          return "failed";
        }

        const reason = (e as any).reason;

        test.skipClass = { reason, origin: `:${propertyKey}` };

        recordHook(ctx, {
          className: test.name,
          hookName,
          type,
          status: "dskip",
          duration,
          timeout,
          reason,
        });

        outcome = "skipped";
        continue;
      }

      recordHook(ctx, {
        className: test.name,
        hookName,
        type,
        status: "failed",
        duration,
        timeout,
        error: e,
      });

      return "failed";
    } finally {
      exitLocation(hookName);
    }
  }

  return outcome;
}
