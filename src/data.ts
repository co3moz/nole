import { Test } from "./test";

const KEY = '_mole_hash';

export function HashMap(): Map<any, Test> {
  let g: any = global || {};

  if (g[KEY]) {
    return g[KEY];
  }

  return g[KEY] = new Map<any, Test>();
}