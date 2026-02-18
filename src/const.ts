import * as clrs from "colors/safe.js";

export const colors = (clrs as any).default;

export const OK_TEXT = colors.bold(colors.green("   (ok)   "));
export const SKIP_TEXT = colors.bold(colors.yellow("  (skip)  "));
export const DYNAMIC_SKIP_TEXT = colors.bold(colors.blue(" (dskip)   "));
export const FAILED_TEXT = colors.bold(colors.red(" (failed) "));
export const HOOK_FAILED_TEXT = colors.bold(colors.red(" (hook failed) "));

export const DEFAULT_TIMEOUT = 5000;
