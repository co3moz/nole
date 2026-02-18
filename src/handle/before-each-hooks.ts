import { HookType, TestWrap } from "../test-wrap.js";
import { Executor } from "../utils/executor.js";
import { TimeFactor } from "../utils/time_factor.js";
import {
  colors,
  DEFAULT_TIMEOUT,
  HOOK_FAILED_TEXT,
  OK_TEXT,
} from "../const.js";

export async function handleBeforeEachHooks(test: TestWrap) {
  const timeout = test.config.timeout ?? DEFAULT_TIMEOUT;

  for (let [propertyKey, hook] of test.hooks.entries()) {
    if (hook.type != HookType.BeforeEach) continue;
    let hookName = colors.bold(
      colors.yellow(
        test.name +
          (propertyKey != "beforeEach"
            ? `.${propertyKey}:beforeEach`
            : ":beforeEach"),
      ),
    );

    try {
      await Executor(
        test.testInstance[propertyKey].bind(test.testInstance),
        timeout,
      );

      let timeText = TimeFactor(0, timeout);

      console.log(`${OK_TEXT} ${timeText} ${hookName}()`);
    } catch (e) {
      console.error(`${HOOK_FAILED_TEXT} ${hookName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }
  }
}
