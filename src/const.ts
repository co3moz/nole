import * as clrs from "colors/safe.js";

export const colors = (clrs as any).default;

// Every label is exactly ten characters wide so the columns line up. A failing
// hook uses the same label as a failing spec; the name carries the ":before".
export const OK_TEXT = colors.bold(colors.green("   (ok)   "));
export const SKIP_TEXT = colors.bold(colors.yellow("  (skip)  "));
export const DYNAMIC_SKIP_TEXT = colors.bold(colors.blue(" (dskip)  "));
export const FAILED_TEXT = colors.bold(colors.red(" (failed) "));
export const RETRY_TEXT = colors.bold(colors.magenta(" (retry)  "));
export const BLOCKED_TEXT = colors.bold(colors.grey(" (block)  "));

/** width of the column TimeFactor renders into */
export const TIME_WIDTH = 9;

export const DEFAULT_TIMEOUT = 5000;
