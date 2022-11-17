import * as clrs from "colors/safe.js";

const colors = (clrs as any).default;

export function TimeFactor(diff: number, timeout: number) {
  if (diff < timeout / 5) {
    return colors.green(TimeResolve(diff).padStart(9, " "));
  }

  if (diff < timeout / 2) {
    return colors.yellow(TimeResolve(diff).padStart(9, " "));
  }

  return colors.red(TimeResolve(diff).padStart(9, " "));
}

export function TimeResolve(ms: number) {
  if (ms < 1000) {
    return ((ms * 100) | 0) / 100 + " ms";
  }

  if (ms < 60 * 1000) {
    return ((ms / 10) | 0) / 100 + " s";
  }

  if (ms < 60 * 60 * 1000) {
    return ((ms / 600) | 0) / 100 + " m";
  }

  return ((ms / 36000) | 0) / 100 + " h";
}

export function Delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
