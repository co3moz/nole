import { HookType, TestWrap } from "../test-wrap.js";
import { Executor } from "../utils/executor.js";
import { TimeDifference } from "../utils/time_difference.js";
import { TimeFactor } from "../utils/time_factor.js";
import {
  colors,
  DEFAULT_TIMEOUT,
  HOOK_FAILED_TEXT,
  OK_TEXT,
} from "../const.js";

export async function handleCleanUp(test: TestWrap) {
  const timeout = test.config.timeout ?? DEFAULT_TIMEOUT;

  if (test.cleanUpCalled) return;
  if (
    !test.dependents.every(
      (dependent) => dependent.isFinished && dependent.cleanUpCalled,
    )
  )
    return;

  test.cleanUpCalled = true;

  for (let [propertyKey, hook] of test.hooks.entries()) {
    if (hook.type != HookType.CleanUp) continue;

    let hookName = colors.bold(
      colors.yellow(
        test.name +
          (propertyKey != "cleanUp" ? `.${propertyKey}:cleanUp` : ":cleanUp"),
      ),
    );
    let start = TimeDifference.begin();

    try {
      await Executor(
        test.testInstance[propertyKey].bind(test.testInstance),
        timeout,
      );

      let timeText = TimeFactor(start.end(), timeout);

      console.log(`${OK_TEXT} ${timeText} ${hookName}()`);
    } catch (e) {
      console.error(`${HOOK_FAILED_TEXT} ${hookName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }
  }

  for (let tree of test.dependencies) {
    await handleCleanUp(tree.dependency);
  }
}
