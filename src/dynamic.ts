export function skipTest(reason?: string) {
  throw new NoleManualSkip(reason);
}

class NoleManualSkip extends Error {
  _nole_anchor = 1;

  constructor(public reason?: string) {
    super(`Dynamicly skipped! ${reason}`);
  }
}