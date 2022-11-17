import { Spec } from "../index.js";
import { Delay, TimeFactor } from "./time_factor.js";

export class TimeFactorTest {
  @Spec()
  async evaluate() {
    await Delay(1);

    for (const n of [
      100,
      1000,
      60 * 1000,
      120 * 1000,
      60 * 60 * 1000,
      65 * 60 * 1000,
      25 * 60 * 60 * 1000,
    ]) {
      TimeFactor(n / 1000, n);
      TimeFactor(n / 500, n);
      TimeFactor(n / 10, n);
      TimeFactor(n / 6, n);
      TimeFactor(n / 4, n);
      TimeFactor(n / 2, n);
      TimeFactor(n / 1.5, n);
      TimeFactor(n, n);
      TimeFactor(n * 2, n);
    }
  }
}
