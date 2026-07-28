import type { ResolvedOptions } from "./config.js";
import type { Reporter } from "./reporter/index.js";
import type { HookResult, SpecResult } from "./results.js";

/**
 * Everything a single run needs to carry around: where to report, what the user
 * asked for and what happened so far.
 */
export interface RunContext {
  reporter: Reporter;
  options: ResolvedOptions;
  specs: SpecResult[];
  hooks: HookResult[];
  /** set once anything fails, drives the exit code */
  failed: boolean;
  /** set by --bail or by a signal, stops new work from starting */
  aborted: boolean;
}

export function recordSpec(ctx: RunContext, result: SpecResult) {
  ctx.specs.push(result);
  ctx.reporter.specResult(result);

  if (result.status === "failed") {
    ctx.failed = true;

    if (ctx.options.bail) {
      ctx.aborted = true;
    }
  }
}

export function recordHook(ctx: RunContext, result: HookResult) {
  ctx.hooks.push(result);
  ctx.reporter.hookResult(result);

  if (result.status === "failed") {
    ctx.failed = true;

    if (ctx.options.bail) {
      ctx.aborted = true;
    }
  }
}

/**
 * Specs that are executing right now. Used to blame the right test when an
 * unhandled rejection or an uncaught exception escapes into the process.
 */
const active = new Set<string>();

export function enterLocation(name: string) {
  active.add(name);
}

export function exitLocation(name: string) {
  active.delete(name);
}

export function activeLocations(): string[] {
  return Array.from(active);
}
