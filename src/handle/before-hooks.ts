import { HookType, TestWrap } from "../test-wrap.js";
import { Executor } from "../utils/executor.js";
import { TimeFactor } from "../utils/time_factor.js";
import {
  colors,
  DEFAULT_TIMEOUT,
  DYNAMIC_SKIP_TEXT,
  HOOK_FAILED_TEXT,
  OK_TEXT,
} from "../const.js";

export async function handleBeforeHooks(test: TestWrap) {
  const timeout = test.config.timeout ?? DEFAULT_TIMEOUT;

  for (let [propertyKey, hook] of test.hooks.entries()) {
    if (hook.type != HookType.Before) continue;

    let hookName = colors.bold(
      colors.yellow(
        test.name +
          (propertyKey != "before" ? `.${propertyKey}:before` : ":before"),
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
      const anchor = (e as any)?._nole_anchor;
      if (anchor === 1) {
        throw new Error(
          "You cannot just skip the before hook! Probably you ment to skip the whole test class!",
        );
      } else if (anchor === 2) {
        let reason = (e as any).reason;
        test.skipClass = { reason, origin: ":" + propertyKey };
        console.log(
          `${DYNAMIC_SKIP_TEXT} ${" ".repeat(8)} ${hookName}() ${
            reason ? "{" + reason + "}" : ""
          }`,
        );
        continue;
      }

      console.error(`${HOOK_FAILED_TEXT} ${hookName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }
  }
}
