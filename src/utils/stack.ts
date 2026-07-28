import * as path from "path";
import * as util from "util";
import { colors } from "../const.js";

const FRAME = /\(?((?:file:\/\/)?[A-Za-z]?:?[\\/][^\s)]+):\d+:\d+\)?$/;

/**
 * Works out where nole itself lives without touching `import.meta`, so the same
 * source compiles to both the ESM and the CommonJS build.
 */
function packageRoot(): string | null {
  const frames = (new Error().stack ?? "").split("\n").slice(1);

  for (const frame of frames) {
    const match = FRAME.exec(frame.trim());

    if (match) {
      const file = match[1].replace(/^file:\/\//, "");

      // <root>/src/utils/stack.ts or <root>/dist/utils/stack.js
      return path.dirname(path.dirname(path.dirname(file)));
    }
  }

  return null;
}

const ROOT = packageRoot();

function isInternalFrame(frame: string): boolean {
  const trimmed = frame.trim();

  if (!trimmed.startsWith("at ")) {
    return false;
  }

  if (trimmed.includes("node:internal") || trimmed.includes("(<anonymous>)")) {
    return true;
  }

  const match = FRAME.exec(trimmed);

  if (!match || !ROOT) {
    return false;
  }

  const file = match[1].replace(/^file:\/\//, "");

  // nole's own test files are user code as far as the report is concerned
  if (/\.test\.[cm]?[jt]s$/.test(file)) {
    return false;
  }

  return (
    file.startsWith(path.join(ROOT, "src") + path.sep) ||
    file.startsWith(path.join(ROOT, "dist") + path.sep) ||
    file.includes(`${path.sep}node_modules${path.sep}tsx${path.sep}`)
  );
}

/**
 * Drops nole's own frames so the first line of the trace is the user's code.
 * Falls back to the untouched stack when filtering would leave nothing useful.
 */
export function cleanStack(stack: string): string {
  const lines = stack.split("\n");
  const head: string[] = [];
  const frames: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith("at ")) {
      frames.push(line);
    } else if (!frames.length) {
      head.push(line);
    }
  }

  const kept = frames.filter((frame) => !isInternalFrame(frame));

  if (!kept.length) {
    return stack;
  }

  return [...head, ...kept].join("\n");
}

function isAssertionError(
  error: any,
): error is { actual: unknown; expected: unknown; operator?: string } {
  return (
    !!error &&
    typeof error === "object" &&
    "actual" in error &&
    "expected" in error &&
    error.expected !== undefined
  );
}

function inspect(value: unknown): string[] {
  return util
    .inspect(value, { depth: 4, sorted: true, breakLength: 72 })
    .split("\n");
}

/**
 * A small line oriented diff. Not a full LCS, just enough to point at the lines
 * that differ, which is what an assertion failure usually needs.
 */
export function renderDiff(actual: unknown, expected: unknown): string {
  const actualLines = inspect(actual);
  const expectedLines = inspect(expected);
  const out: string[] = [
    `${colors.green("- expected")} ${colors.red("+ actual")}`,
    "",
  ];

  const length = Math.max(actualLines.length, expectedLines.length);

  for (let i = 0; i < length; i++) {
    const a = actualLines[i];
    const e = expectedLines[i];

    if (a === e) {
      out.push(`  ${a}`);
      continue;
    }

    if (e !== undefined) {
      out.push(colors.green(`- ${e}`));
    }

    if (a !== undefined) {
      out.push(colors.red(`+ ${a}`));
    }
  }

  return out.join("\n");
}

/**
 * Turns whatever a spec threw into something worth printing: a filtered stack
 * plus an expected/actual diff when the error looks like an assertion.
 */
export function formatError(error: unknown, indent = "    "): string {
  const parts: string[] = [];
  const stack = (error as any)?.stack;

  parts.push(typeof stack === "string" ? cleanStack(stack) : String(error));

  if (isAssertionError(error)) {
    parts.push("", renderDiff(error.actual, error.expected));
  }

  return parts
    .join("\n")
    .split("\n")
    .map((line) => indent + line)
    .join("\n");
}

/** Single line version used while the run is still streaming. */
export function errorHeadline(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.split("\n")[0];
  }

  return String(error).split("\n")[0];
}
