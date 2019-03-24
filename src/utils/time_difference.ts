/**
 * Calculates the time difference in nanoseconds
 */
export class TimeDifference {
  private startAt: [number, number];

  private constructor() {
    this.startAt = process.hrtime();
  }


  /**
   * Creates the instance at the begining
   */
  public static begin() {
    return new TimeDifference();
  }


  /**
   * Finishes the time, returns data in milliseconds
   */
  end(): number {
    let diff = process.hrtime(this.startAt);

    return diff[0] * 1000 + diff[1] / 1e6;
  }
}