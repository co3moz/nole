import { HookType, TestWrap } from "../test-wrap.js";
import { Executor } from "../utils/executor.js";
import { TimeDifference } from "../utils/time_difference.js";
import { TimeFactor } from "../utils/time_factor.js";
import { handleAfterEachHooks } from "./after-each-hooks.js";
import { handleBeforeEachHooks } from "./before-each-hooks.js";
import {
  colors,
  DEFAULT_TIMEOUT,
  DYNAMIC_SKIP_TEXT,
  FAILED_TEXT,
  OK_TEXT,
  SKIP_TEXT,
} from "../const.js";

export async function handleSpecs(test: TestWrap) {
  const timeout = test.config.timeout ?? DEFAULT_TIMEOUT;

  for (let [propertyKey, spec] of test.specs.entries()) {
    let testName = colors.bold(colors.yellow(test.name + "." + propertyKey));

    const shouldPropertySkip = test.skip.has(propertyKey);
    if (shouldPropertySkip || test.skipClass) {
      let reason = shouldPropertySkip
        ? test.skip.get(propertyKey)!.reason
        : test.skipClass!.reason;
      console.log(
        `${SKIP_TEXT} ${" ".repeat(9)} ${testName}() ${
          reason ? "{" + reason + "}" : ""
        }`,
      );
      continue;
    }

    await handleBeforeEachHooks(test);

    let start = TimeDifference.begin();

    try {
      await Executor(
        test.testInstance[propertyKey].bind(test.testInstance),
        timeout,
      );

      let timeText = TimeFactor(start.end(), timeout);

      console.log(`${OK_TEXT} ${timeText} ${testName}()`);
    } catch (e) {
      if ((e as any)?._nole_anchor) {
        let reason = (e as any).reason;
        console.log(
          `${DYNAMIC_SKIP_TEXT} ${" ".repeat(8)} ${testName}() ${
            reason ? "{" + reason + "}" : ""
          }`,
        );
        continue;
      }

      let timeText = TimeFactor(start.end(), timeout);

      console.error(`${FAILED_TEXT} ${timeText} ${testName}()`);
      console.error((e as any)?.stack ?? e);
      throw e;
    }

    await handleAfterEachHooks(test);
  }
}
