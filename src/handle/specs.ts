import { HookType, TestWrap, type ISkip } from "../test-wrap.js";
import { Executor } from "../utils/executor.js";
import { TimeDifference } from "../utils/time_difference.js";
import { enterLocation, exitLocation, recordSpec } from "../context.js";
import type { RunContext } from "../context.js";
import type { SpecResult } from "../results.js";
import { resolveTimeout, runHooks } from "./hooks.js";

export async function handleSpecs(test: TestWrap, ctx: RunContext) {
  const timeout = resolveTimeout(test, ctx);
  const retries = test.config.retries ?? ctx.options.retries;

  for (const propertyKey of test.specs.keys()) {
    const base: SpecResult = {
      className: test.name,
      specName: propertyKey,
      status: "ok",
      duration: 0,
      timeout,
      attempts: 1,
      flaky: false,
    };

    if (test.filtered.has(propertyKey)) {
      recordSpec(ctx, { ...base, status: "filtered" });
      continue;
    }

    if (test.blocked) {
      recordSpec(ctx, { ...base, status: "blocked", reason: test.blocked });
      continue;
    }

    if (ctx.aborted) {
      recordSpec(ctx, {
        ...base,
        status: "blocked",
        reason: "run stopped early",
      });
      continue;
    }

    const staticSkip = test.skip.get(propertyKey);

    if (staticSkip || test.skipClass) {
      const skip = staticSkip ?? test.skipClass!;
      const origin = staticSkip ? undefined : test.skipClass!.origin;

      recordSpec(ctx, {
        ...base,
        status: origin ? "dskip" : "skipped",
        reason: skip.reason,
        origin,
      });
      continue;
    }

    // A failing afterEach leaves the instance in an unknown state, so it stops
    // the class the same way a failing beforeEach does.
    const afterEach = async () => {
      if ((await runHooks(test, ctx, HookType.AfterEach)) === "failed") {
        test.blocked = "afterEach hook failed";
        return false;
      }

      return true;
    };

    let attempt = 0;
    let stop = false;

    while (!stop) {
      attempt++;

      const beforeEach = await runHooks(test, ctx, HookType.BeforeEach);

      if (beforeEach === "failed") {
        test.blocked = "beforeEach hook failed";

        recordSpec(ctx, {
          ...base,
          status: "blocked",
          attempts: attempt,
          reason: test.blocked,
        });

        // the remaining specs are recorded as blocked by the loop above
        break;
      }

      if (beforeEach === "skipped") {
        // the hook called skipClass(), so the class is skipped from here on
        const classSkip = test.skipClass as ISkip | null;

        recordSpec(ctx, {
          ...base,
          status: "dskip",
          attempts: attempt,
          reason: classSkip?.reason,
          origin: classSkip?.origin,
        });

        break;
      }

      const location = `${test.name}.${propertyKey}`;
      const start = TimeDifference.begin();

      let error: unknown;
      let thrown = false;

      enterLocation(location);

      try {
        await Executor(
          test.testInstance[propertyKey].bind(test.testInstance),
          timeout,
        );
      } catch (e) {
        thrown = true;
        error = e;
      } finally {
        exitLocation(location);
      }

      const duration = start.end();

      if (!thrown) {
        recordSpec(ctx, {
          ...base,
          status: "ok",
          duration,
          attempts: attempt,
          flaky: attempt > 1,
        });

        await afterEach();
        break;
      }

      const anchor = (error as any)?._nole_anchor;

      if (anchor === 1 || anchor === 2) {
        const reason = (error as any).reason;

        if (anchor === 2) {
          test.skipClass = { reason, origin: `.${propertyKey}` };
        }

        recordSpec(ctx, {
          ...base,
          status: "dskip",
          duration,
          attempts: attempt,
          reason,
        });

        await afterEach();
        break;
      }

      if (attempt <= retries) {
        ctx.reporter.retry({
          className: test.name,
          specName: propertyKey,
          attempt,
          remaining: retries - attempt + 1,
          error,
        });

        if (!(await afterEach())) break;
        continue;
      }

      recordSpec(ctx, {
        ...base,
        status: "failed",
        duration,
        attempts: attempt,
        error,
      });

      await afterEach();
      stop = true;
    }
  }
}
