/**
 * Waiter interface for waiting for a condition to be met.
 * @template T The type of the result of the condition.
 */
export type Waiter<T> = {
  /**
   * Waits for a condition to be met.
   * @returns {Promise<T>} A promise that resolves to the result of the condition.
   */
  waitForCondition(): Promise<T>;

  /**
   * Cancels the wait.
   */
  cancel(): void;
}

/**
 * Waiter that polls for a condition to be met, with a timeout.
 * It allows for custom intervals for polling to be used.
 * @template T The type of the result of the condition.
 */
export class TimeoutWaiter<T> implements Waiter<T> {
  private condition: () => T | Promise<T>;
  private timeout: number;
  private intervals: number[];
  private currentIntervalIndex = 0;
  private intervalId: ReturnType<typeof setTimeout> | null = null;
  private cancelled = false;

  /**
   * Initializes a new instance of the TimeoutWaiter class.
   * @param condition {() => T | Promise<T>} A Function testing the condition to poll for.
   * @param timeoutInMilliseconds {number} The timeout in milliseconds. If omitted, the timeout is zero, implying the check will execute once.
   * @param pollIntervalsInMilliseconds {number[]} An array of the intervals in milliseconds to poll at. If omitted, the default interval of 100ms is used.
   */
  constructor(condition: () => T | Promise<T>, timeoutInMilliseconds: number = 0, pollIntervalsInMilliseconds: number[] = [100]) {
    this.condition = condition;
    this.timeout = timeoutInMilliseconds;
    this.intervals = pollIntervalsInMilliseconds;
  }

  /**
   * Waits for the condition to be met.
   * @returns {Promise<T>} A Promise that resolves to the result of the condition. The Promise is rejected if the timeout is reached, or if the wait is cancelled..
   */
  waitForCondition(): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.cancelled = false;
      this.currentIntervalIndex = 0;
      const endTime = performance.now() + this.timeout;

      const checkCondition = async () => {
        if (this.cancelled) {
          reject(new Error('Wait cancelled'));
          return;
        }

        try {
          const result = await this.condition();
          if (result) {
            this.cleanup();
            resolve(result);
            return;
          }
        } catch {
          // Condition threw an error, continue polling
        }

        // Check timeout after condition evaluation
        if (performance.now() >= endTime) {
          this.cleanup();
          reject(new Error(`Timeout after ${this.timeout}ms`));
          return;
        }

        // Get the current interval and advance the index (capped at last element)
        const currentInterval = this.intervals[Math.min(this.currentIntervalIndex++, this.intervals.length - 1)];

        // Schedule next check
        this.intervalId = setTimeout(() => void checkCondition(), currentInterval);
      };

      // Start checking
      void checkCondition();
    });
  }

  /**
   * Cancels the wait.
   */
  cancel(): void {
    this.cancelled = true;
    this.cleanup();
  }

  /**
   * Cleans up the waiter.
   */
  private cleanup(): void {
    if (this.intervalId !== null) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }
}

/**
 * Waiter that polls for a condition to be met using requestAnimationFrame, with a timeout.
 * This waiter checks the condition on every animation frame (typically ~60fps).
 * @template T The type of the result of the condition.
 */
export class RequestAnimationFrameWaiter<T> implements Waiter<T> {
  private condition: () => T | Promise<T>;
  private timeout: number;
  private rafId: number | null = null;
  private cancelled = false;

  /**
   * Initializes a new instance of the RequestAnimationFrameWaiter class.
   * @param condition {() => T | Promise<T>} A Function testing the condition to poll for.
   * @param timeoutInMilliseconds {number} The timeout in milliseconds. If omitted, the timeout is zero, implying the check will execute once.
   */
  constructor(condition: () => T | Promise<T>, timeoutInMilliseconds: number = 0) {
    this.condition = condition;
    this.timeout = timeoutInMilliseconds;
  }

  /**
   * Waits for the condition to be met.
   * @returns {Promise<T>} A Promise that resolves to the result of the condition. The Promise is rejected if the timeout is reached, or if the wait is cancelled.
   */
  waitForCondition(): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.cancelled = false;
      const endTime = performance.now() + this.timeout;

      const checkCondition = async () => {
        if (this.cancelled) {
          reject(new Error('Wait cancelled'));
          return;
        }

        try {
          const result = await this.condition();
          if (result) {
            this.cleanup();
            resolve(result);
            return;
          }
        } catch {
          // Condition threw an error, continue polling
        }

        // Check timeout after condition evaluation
        if (performance.now() >= endTime) {
          this.cleanup();
          reject(new Error(`Timeout after ${this.timeout}ms`));
          return;
        }

        // Schedule next check on the next animation frame
        this.rafId = globalThis.requestAnimationFrame(() => void checkCondition());
      };

      // Start checking
      void checkCondition();
    });
  }

  /**
   * Cancels the wait.
   */
  cancel(): void {
    this.cancelled = true;
    this.cleanup();
  }

  /**
   * Cleans up the waiter.
   */
  private cleanup(): void {
    if (this.rafId !== null) {
      globalThis.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
