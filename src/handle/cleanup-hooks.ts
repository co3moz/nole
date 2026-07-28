import { HookType, TestWrap } from "../test-wrap.js";
import type { RunContext } from "../context.js";
import { runHooks } from "./hooks.js";

/**
 * Cleans a class up once every dependent is done with it, then walks down to
 * its own dependencies. `force` skips the dependent check, which is what the
 * final sweep uses after a failed or interrupted run.
 */
export async function handleCleanUp(
  test: TestWrap,
  ctx: RunContext,
  force = false,
) {
  if (test.cleanUpCalled) return;
  if (!test.testInstance) return;
  // a class that --grep excluded never opened anything to close
  if (test.excluded) return;

  if (
    !force &&
    !test.dependents.every(
      (dependent) => dependent.isFinished && dependent.cleanUpCalled,
    )
  ) {
    return;
  }

  test.cleanUpCalled = true;

  await runHooks(test, ctx, HookType.CleanUp);

  for (const tree of test.dependencies) {
    await handleCleanUp(tree.dependency, ctx, force);
  }
}
