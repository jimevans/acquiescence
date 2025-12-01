import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeoutWaiter, RequestAnimationFrameWaiter } from '../waiter';

describe('TimeoutWaiter', () => {
  describe('constructor', () => {
    it('should create a TimeoutWaiter with valid parameters', () => {
      const condition = () => true;
      const waiter = new TimeoutWaiter(condition, 1000, [100, 200]);
      expect(waiter).toBeInstanceOf(TimeoutWaiter);
    });

    it('should default to [100] interval when empty array is provided', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 3;
      };

      const waiter = new TimeoutWaiter(condition, 1000, []);
      await waiter.waitForCondition();
      
      expect(callCount).toBe(3);
    }, 2000);

    it('should use default timeout (0) when not provided', async () => {
      // With timeout = 0, condition still runs at least once but then times out
      let callCount = 0;
      const condition = () => {
        callCount++;
        return false;
      };
      const waiter = new TimeoutWaiter(condition);
      
      await expect(waiter.waitForCondition()).rejects.toThrow('Timeout after 0ms');
      expect(callCount).toBe(1); // Condition runs exactly once
    }, 1000);

    it('should use default pollIntervals ([100]) when not provided', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 3;
      };

      const waiter = new TimeoutWaiter(condition, 500);
      await waiter.waitForCondition();
      
      expect(callCount).toBe(3);
    }, 1000);

    it('should use both default parameters when only condition is provided', async () => {
      // With timeout = 0 (default), condition still runs at least once
      const condition = () => true;
      const waiter = new TimeoutWaiter(condition);
      
      const result = await waiter.waitForCondition();
      expect(result).toBe(true);
    }, 1000);
  });

  describe('waitForCondition - basic success cases', () => {
    it('should resolve immediately when condition is true on first check', async () => {
      const condition = () => 'success';
      const waiter = new TimeoutWaiter(condition, 100, [10]);
      
      const result = await waiter.waitForCondition();
      
      expect(result).toBe('success');
    }, 1000);

    it('should resolve when condition becomes true after polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 3 ? 'result' : false;
      };

      const waiter = new TimeoutWaiter(condition, 500, [10]);
      const result = await waiter.waitForCondition();

      expect(result).toBe('result');
      expect(callCount).toBe(3);
    }, 1000);

    it('should work with async conditions', async () => {
      let callCount = 0;
      const condition = async () => {
        callCount++;
        await Promise.resolve();
        return callCount === 2 ? 'async result' : false;
      };

      const waiter = new TimeoutWaiter(condition, 500, [10]);
      const result = await waiter.waitForCondition();

      expect(result).toBe('async result');
      expect(callCount).toBe(2);
    }, 1000);

    it('should work with complex return types', async () => {
      interface Result { data: string; code: number };
      const expectedResult: Result = { data: 'test', code: 200 };
      const condition = () => expectedResult;

      const waiter = new TimeoutWaiter<Result>(condition, 100, [10]);
      const result = await waiter.waitForCondition();

      expect(result).toEqual(expectedResult);
    }, 1000);
  });

  describe('waitForCondition - timeout behavior', () => {
    it('should reject with timeout error when condition never becomes true', async () => {
      const condition = () => false;
      const waiter = new TimeoutWaiter(condition, 50, [10]);
      
      await expect(waiter.waitForCondition()).rejects.toThrow('Timeout after 50ms');
    }, 1000);

    it('should reject when timeout occurs during polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return false;
      };

      const waiter = new TimeoutWaiter(condition, 50, [10]);
      
      await expect(waiter.waitForCondition()).rejects.toThrow('Timeout after 50ms');
      
      // Should have checked multiple times before timeout
      expect(callCount).toBeGreaterThan(1);
    }, 1000);

    it('should respect timeout even with very short intervals', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return false;
      };

      const waiter = new TimeoutWaiter(condition, 50, [5]);
      
      await expect(waiter.waitForCondition()).rejects.toThrow('Timeout after 50ms');
      
      expect(callCount).toBeGreaterThanOrEqual(5);
    }, 1000);
  });

  describe('waitForCondition - interval progression', () => {
    it('should use different intervals in sequence', async () => {
      const checkTimes: number[] = [];
      const startTime = performance.now();
      
      const condition = () => {
        checkTimes.push(performance.now() - startTime);
        return checkTimes.length === 4 ? 'done' : false;
      };

      const waiter = new TimeoutWaiter(condition, 500, [10, 20, 30]);
      await waiter.waitForCondition();

      expect(checkTimes.length).toBe(4);
      // First check is immediate (around 0ms)
      expect(checkTimes[0]).toBeLessThan(5);
      // Second check after ~10ms
      expect(checkTimes[1]).toBeGreaterThanOrEqual(8);
      expect(checkTimes[1]).toBeLessThan(20);
      // Third check after ~30ms (10 + 20)
      expect(checkTimes[2]).toBeGreaterThanOrEqual(25);
      expect(checkTimes[2]).toBeLessThan(40);
      // Fourth check after ~60ms (10 + 20 + 30)
      expect(checkTimes[3]).toBeGreaterThanOrEqual(50);
      expect(checkTimes[3]).toBeLessThan(80);
    }, 1000);

    it('should stick with last interval after exhausting interval array', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 5 ? 'done' : false;
      };

      const waiter = new TimeoutWaiter(condition, 500, [5, 10]);
      await waiter.waitForCondition();

      expect(callCount).toBe(5);
    }, 1000);

    it('should work with single interval', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 5 ? 'done' : false;
      };

      const waiter = new TimeoutWaiter(condition, 500, [10]);
      await waiter.waitForCondition();

      expect(callCount).toBe(5);
    }, 1000);
  });

  describe('waitForCondition - error handling', () => {
    it('should continue polling when condition throws an error', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Condition error');
        }
        return 'recovered';
      };

      const waiter = new TimeoutWaiter(condition, 500, [10]);
      const result = await waiter.waitForCondition();

      expect(result).toBe('recovered');
      expect(callCount).toBe(3);
    }, 1000);

    it('should continue polling when async condition rejects', async () => {
      let callCount = 0;
      const condition = async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Async error');
        }
        return 'success';
      };

      const waiter = new TimeoutWaiter(condition, 500, [10]);
      const result = await waiter.waitForCondition();

      expect(result).toBe('success');
      expect(callCount).toBe(2);
    }, 1000);

    it('should timeout even if condition keeps throwing', async () => {
      const condition = () => {
        throw new Error('Always fails');
      };

      const waiter = new TimeoutWaiter(condition, 50, [10]);
      
      await expect(waiter.waitForCondition()).rejects.toThrow('Timeout after 50ms');
    }, 1000);
  });

  describe('waitForCondition - falsy values', () => {
    it('should treat null as falsy and continue polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 2 ? 'truthy' : null;
      };

      const waiter = new TimeoutWaiter<string | null>(condition, 500, [10]);
      const result = await waiter.waitForCondition();

      expect(result).toBe('truthy');
    }, 1000);

    it('should treat undefined as falsy and continue polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 2 ? 'truthy' : undefined;
      };

      const waiter = new TimeoutWaiter<string | undefined>(condition, 500, [10]);
      const result = await waiter.waitForCondition();

      expect(result).toBe('truthy');
    }, 1000);

    it('should treat 0 as falsy and continue polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 2 ? 42 : 0;
      };

      const waiter = new TimeoutWaiter<number>(condition, 500, [10]);
      const result = await waiter.waitForCondition();

      expect(result).toBe(42);
    }, 1000);

    it('should treat empty string as falsy and continue polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 2 ? 'result' : '';
      };

      const waiter = new TimeoutWaiter<string>(condition, 500, [10]);
      const result = await waiter.waitForCondition();

      expect(result).toBe('result');
    }, 1000);

    it('should treat false as falsy and continue polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 2 ? true : false;
      };

      const waiter = new TimeoutWaiter<boolean>(condition, 500, [10]);
      const result = await waiter.waitForCondition();

      expect(result).toBe(true);
    }, 1000);
  });

  describe('cancel', () => {
    it('should cancel the wait and reject with cancellation error when called synchronously', async () => {
      let checkCount = 0;
      const condition = () => {
        checkCount++;
        // Return false to force polling
        return false;
      };
      const waiter = new TimeoutWaiter(condition, 500, [10]);
      
      const promise = waiter.waitForCondition();
      
      // Cancel immediately while the first check is still being processed
      waiter.cancel();

      await expect(promise).rejects.toThrow('Wait cancelled');
      // First check should have started
      expect(checkCount).toBeGreaterThanOrEqual(1);
    }, 1000);

    it('should prevent further condition checks when cancelled early', async () => {
      let callCount = 0;
      let resolveCondition: ((value: boolean) => void) | null = null;
      
      const condition = () => {
        callCount++;
        // Return a promise that we control
        return new Promise<boolean>((res) => {
          resolveCondition = res;
        });
      };

      const waiter = new TimeoutWaiter(condition, 500, [10]);
      const promise = waiter.waitForCondition();

      // Wait for first check to start
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(callCount).toBe(1);
      
      // Cancel while the condition check is pending
      waiter.cancel();
      
      // Resolve the pending condition check
      resolveCondition!(false);
      
      // The cancel should prevent the promise from resolving
      await expect(promise).rejects.toThrow('Wait cancelled');
      
      // Wait a bit more to ensure no additional checks happen
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should still be 1 as no more checks should have occurred
      expect(callCount).toBe(1);
    }, 1000);

    it('should be safe to call cancel multiple times', async () => {
      const condition = () => false;
      const waiter = new TimeoutWaiter(condition, 500, [10]);
      
      const promise = waiter.waitForCondition();

      waiter.cancel();
      waiter.cancel();
      waiter.cancel();

      await expect(promise).rejects.toThrow('Wait cancelled');
    }, 1000);

    it('should cancel immediately without waiting', async () => {
      const condition = () => false;
      const waiter = new TimeoutWaiter(condition, 500, [10]);
      
      const promise = waiter.waitForCondition();
      waiter.cancel();

      await expect(promise).rejects.toThrow('Wait cancelled');
    }, 1000);
  });

  describe('multiple waitForCondition calls', () => {
    it('should reset state when calling waitForCondition again', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 2 || callCount === 4 ? 'done' : false;
      };

      const waiter = new TimeoutWaiter(condition, 500, [10]);

      // First wait
      const result1 = await waiter.waitForCondition();
      expect(result1).toBe('done');
      expect(callCount).toBe(2);

      // Second wait should work independently
      const result2 = await waiter.waitForCondition();
      expect(result2).toBe('done');
      expect(callCount).toBe(4);
    }, 1000);

    it('should reset interval index on new waitForCondition call', async () => {
      const checkIntervals: number[][] = [[], []];
      let lastTime = 0;
      let iteration = 0;
      let waitCall = 0;

      const condition = () => {
        const now = performance.now();
        if (iteration > 0) {
          checkIntervals[waitCall].push(now - lastTime);
        }
        lastTime = now;
        iteration++;
        return iteration === 3 || iteration === 6 ? 'done' : false;
      };

      const waiter = new TimeoutWaiter(condition, 500, [10, 20]);

      // First wait - should use intervals 10, 20
      await waiter.waitForCondition();

      // Reset for second wait
      iteration = 0;
      lastTime = performance.now();
      waitCall = 1;

      // Second wait - should start from interval 10 again
      await waiter.waitForCondition();

      // Both waits should have similar interval patterns
      expect(checkIntervals[0].length).toBeGreaterThan(0);
      expect(checkIntervals[1].length).toBeGreaterThan(0);
    }, 1000);

    it('should reset cancelled flag on new waitForCondition call', async () => {
      let firstWait = true;
      const condition = () => {
        // Return false for first wait so we can cancel it
        // Return success for second wait
        return firstWait ? false : 'success';
      };
      const waiter = new TimeoutWaiter(condition, 500, [10]);

      // First wait - cancel it immediately
      const promise1 = waiter.waitForCondition();
      waiter.cancel(); // Cancel while first check is processing
      await expect(promise1).rejects.toThrow('Wait cancelled');

      // Second wait - should work normally
      firstWait = false;
      const result = await waiter.waitForCondition();
      expect(result).toBe('success');
    }, 1000);
  });

  describe('condition guaranteed to run at least once', () => {
    it('should run condition at least once even with zero timeout', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return false;
      };

      const waiter = new TimeoutWaiter(condition, 0, [10]);
      
      await expect(waiter.waitForCondition()).rejects.toThrow('Timeout after 0ms');
      expect(callCount).toBe(1);
    }, 1000);

    it('should return truthy result from first check even with zero timeout', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return 'immediate success';
      };

      const waiter = new TimeoutWaiter(condition, 0, [10]);
      const result = await waiter.waitForCondition();
      
      expect(result).toBe('immediate success');
      expect(callCount).toBe(1);
    }, 1000);

    it('should run condition at least once even if it throws with zero timeout', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        throw new Error('Test error');
      };

      const waiter = new TimeoutWaiter(condition, 0, [10]);
      
      await expect(waiter.waitForCondition()).rejects.toThrow('Timeout after 0ms');
      expect(callCount).toBe(1);
    }, 1000);

    it('should run async condition at least once with zero timeout', async () => {
      let callCount = 0;
      const condition = async () => {
        callCount++;
        await Promise.resolve();
        return false;
      };

      const waiter = new TimeoutWaiter(condition, 0, [10]);
      
      await expect(waiter.waitForCondition()).rejects.toThrow('Timeout after 0ms');
      expect(callCount).toBe(1);
    }, 1000);
  });

  describe('edge cases and stress tests', () => {
    it('should handle condition that becomes true immediately', async () => {
      const condition = () => 'immediate';
      const waiter = new TimeoutWaiter(condition, 100, [10]);
      
      const result = await waiter.waitForCondition();

      expect(result).toBe('immediate');
    }, 1000);

    it('should handle very large timeout values', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 3 ? 'done' : false;
      };

      const waiter = new TimeoutWaiter(condition, Number.MAX_SAFE_INTEGER, [10]);
      const result = await waiter.waitForCondition();

      expect(result).toBe('done');
    }, 1000);

    it('should handle zero timeout', async () => {
      const condition = () => false;
      const waiter = new TimeoutWaiter(condition, 0, [10]);
      
      await expect(waiter.waitForCondition()).rejects.toThrow('Timeout after 0ms');
    }, 1000);

    it('should handle many rapid condition checks', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 20 ? 'done' : false;
      };

      const waiter = new TimeoutWaiter(condition, 500, [1]);
      const result = await waiter.waitForCondition();

      expect(result).toBe('done');
      expect(callCount).toBe(20);
    }, 1000);

    it('should handle condition that alternates between truthy and falsy (first truthy wins)', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        // Returns truthy on odd calls
        return callCount % 2 === 1 ? `call-${callCount}` : false;
      };

      const waiter = new TimeoutWaiter(condition, 100, [10]);
      const result = await waiter.waitForCondition();

      // First check happens immediately and should return truthy
      expect(result).toBe('call-1');
      expect(callCount).toBe(1);
    }, 1000);

    it('should handle very long interval arrays', async () => {
      const intervals = Array.from({ length: 100 }, (_, i) => (i + 1) * 2);
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 5 ? 'done' : false;
      };

      const waiter = new TimeoutWaiter(condition, 1000, intervals);
      const result = await waiter.waitForCondition();

      expect(result).toBe('done');
      expect(callCount).toBe(5);
    }, 1000);

    it('should handle condition with delayed resolution', async () => {
      let callCount = 0;
      const condition = async () => {
        callCount++;
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 5));
        return callCount === 3 ? 'done' : false;
      };

      const waiter = new TimeoutWaiter(condition, 500, [10]);
      const result = await waiter.waitForCondition();

      expect(result).toBe('done');
      expect(callCount).toBe(3);
    }, 1000);

    it('should work correctly when condition takes longer than interval', async () => {
      let callCount = 0;
      const condition = async () => {
        callCount++;
        // Condition takes 15ms but interval is 10ms
        await new Promise(resolve => setTimeout(resolve, 15));
        return callCount === 3 ? 'done' : false;
      };

      const waiter = new TimeoutWaiter(condition, 500, [10]);
      const result = await waiter.waitForCondition();

      expect(result).toBe('done');
      expect(callCount).toBe(3);
    }, 1000);
  });

  describe('performance.now() integration', () => {
    it('should use performance.now() for timeout calculation', async () => {
      const condition = () => 'done';
      const waiter = new TimeoutWaiter(condition, 100, [10]);
      const result = await waiter.waitForCondition();

      expect(result).toBe('done');
    }, 1000);

    it('should enforce timeout based on performance.now()', async () => {
      const checkTimes: number[] = [];
      const startTime = performance.now();
      
      const condition = () => {
        checkTimes.push(performance.now() - startTime);
        return false;
      };

      const waiter = new TimeoutWaiter(condition, 50, [10]);
      
      await expect(waiter.waitForCondition()).rejects.toThrow('Timeout after 50ms');
      
      // Verify that checks happened and timeout was enforced
      expect(checkTimes.length).toBeGreaterThan(1);
      // Last check should be around or just before 50ms
      expect(checkTimes[checkTimes.length - 1]).toBeLessThan(60);
    }, 1000);
  });

  describe('Waiter interface compliance', () => {
    it('should implement waitForCondition method', () => {
      const condition = () => true;
      const waiter = new TimeoutWaiter(condition, 100, [10]);
      
      expect(waiter.waitForCondition).toBeDefined();
      expect(typeof waiter.waitForCondition).toBe('function');
    });

    it('should implement cancel method', () => {
      const condition = () => true;
      const waiter = new TimeoutWaiter(condition, 100, [10]);
      
      expect(waiter.cancel).toBeDefined();
      expect(typeof waiter.cancel).toBe('function');
    });

    it('waitForCondition should return a Promise', () => {
      const condition = () => true;
      const waiter = new TimeoutWaiter(condition, 100, [10]);
      
      const result = waiter.waitForCondition();
      expect(result).toBeInstanceOf(Promise);
      
      // Clean up
      return result;
    }, 1000);
  });
});

describe('RequestAnimationFrameWaiter', () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let rafId = 0;
  let cancelledRafIds: Set<number>;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    cancelledRafIds = new Set();

    // Mock requestAnimationFrame and cancelAnimationFrame
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      const id = ++rafId;
      rafCallbacks.push(callback);
      return id;
    });

    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id: number) => {
      cancelledRafIds.add(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rafCallbacks = [];
    rafId = 0;
    cancelledRafIds.clear();
  });

  // Helper to trigger pending RAF callbacks (only one batch)
  const flushRAF = async () => {
    if (rafCallbacks.length === 0) {
      return;
    }
    const callbacks = [...rafCallbacks];
    rafCallbacks = [];
    for (const callback of callbacks) {
      callback(performance.now());
    }
    // Give microtasks a chance to run
    await Promise.resolve();
    await Promise.resolve();
  };

  describe('constructor', () => {
    it('should create a RequestAnimationFrameWaiter with valid parameters', () => {
      const condition = () => true;
      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      expect(waiter).toBeInstanceOf(RequestAnimationFrameWaiter);
    });

    it('should use default timeout (0) when not provided', async () => {
      // With timeout = 0, condition still runs at least once but then times out
      let callCount = 0;
      const condition = () => {
        callCount++;
        return false;
      };
      const waiter = new RequestAnimationFrameWaiter(condition);
      
      const promise = waiter.waitForCondition();
      await flushRAF();

      await expect(promise).rejects.toThrow('Timeout after 0ms');
      expect(callCount).toBe(1); // Condition runs exactly once
    }, 1000);

    it('should work with only condition parameter using default timeout', async () => {
      // With timeout = 0 (default), condition still runs at least once
      const condition = () => 'success';
      const waiter = new RequestAnimationFrameWaiter(condition);
      
      const promise = waiter.waitForCondition();
      await flushRAF();

      await expect(promise).resolves.toBe('success');
    }, 1000);
  });

  describe('waitForCondition - basic success cases', () => {
    it('should resolve immediately when condition is true on first check', async () => {
      const condition = () => 'success';
      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      
      const promise = waiter.waitForCondition();
      await flushRAF();
      
      await expect(promise).resolves.toBe('success');
    }, 1000);

    it('should resolve when condition becomes true after polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 3 ? 'result' : false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      const promise = waiter.waitForCondition();

      // First RAF check
      await flushRAF();
      expect(callCount).toBe(1);

      // Second RAF check
      await flushRAF();
      expect(callCount).toBe(2);

      // Third RAF check - should resolve
      await flushRAF();
      expect(callCount).toBe(3);

      await expect(promise).resolves.toBe('result');
    }, 1000);

    it('should work with async conditions', async () => {
      let callCount = 0;
      const condition = async () => {
        callCount++;
        await Promise.resolve();
        return callCount === 2 ? 'async result' : false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      const promise = waiter.waitForCondition();

      await flushRAF();
      // Extra delay to let async condition complete
      await Promise.resolve();
      await Promise.resolve();
      expect(callCount).toBe(1);

      await flushRAF();
      // Extra delay to let async condition complete
      await Promise.resolve();
      await Promise.resolve();
      expect(callCount).toBe(2);

      await expect(promise).resolves.toBe('async result');
    }, 1000);

    it('should work with complex return types', async () => {
      interface Result { data: string; code: number };
      const expectedResult: Result = { data: 'test', code: 200 };
      const condition = () => expectedResult;

      const waiter = new RequestAnimationFrameWaiter<Result>(condition, 1000);
      const promise = waiter.waitForCondition();

      await flushRAF();

      await expect(promise).resolves.toEqual(expectedResult);
    }, 1000);
  });

  describe('waitForCondition - timeout behavior', () => {
    it('should reject with timeout error when condition never becomes true', async () => {
      const condition = () => false;
      const waiter = new RequestAnimationFrameWaiter(condition, 50);
      
      const promise = waiter.waitForCondition();

      // Keep polling until timeout
      const startTime = performance.now();
      while (performance.now() - startTime < 100) {
        await flushRAF();
      }

      await expect(promise).rejects.toThrow('Timeout after 50ms');
    }, 1000);

    it('should reject when timeout occurs during polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 50);
      const promise = waiter.waitForCondition();

      const startTime = performance.now();
      while (performance.now() - startTime < 100) {
        await flushRAF();
      }

      await expect(promise).rejects.toThrow('Timeout after 50ms');
      expect(callCount).toBeGreaterThan(1);
    }, 1000);
  });

  describe('waitForCondition - error handling', () => {
    it('should continue polling when condition throws an error', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Condition error');
        }
        return 'recovered';
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      const promise = waiter.waitForCondition();

      // The first check happens immediately (not via RAF)
      await Promise.resolve();
      await Promise.resolve();
      expect(callCount).toBe(1);

      await flushRAF();
      expect(callCount).toBe(2);

      await flushRAF();
      expect(callCount).toBe(3);

      await expect(promise).resolves.toBe('recovered');
    }, 1000);

    it('should continue polling when async condition rejects', async () => {
      let callCount = 0;
      const condition = async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Async error');
        }
        return 'success';
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      const promise = waiter.waitForCondition();

      await flushRAF();
      expect(callCount).toBe(1);

      await flushRAF();
      expect(callCount).toBe(2);

      await expect(promise).resolves.toBe('success');
    }, 1000);

    it('should timeout even if condition keeps throwing', async () => {
      const condition = () => {
        throw new Error('Always fails');
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 50);
      const promise = waiter.waitForCondition();

      const startTime = performance.now();
      while (performance.now() - startTime < 100) {
        await flushRAF();
      }

      await expect(promise).rejects.toThrow('Timeout after 50ms');
    }, 1000);
  });

  describe('waitForCondition - falsy values', () => {
    it('should treat null as falsy and continue polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 2 ? 'truthy' : null;
      };

      const waiter = new RequestAnimationFrameWaiter<string | null>(condition, 1000);
      const promise = waiter.waitForCondition();

      await flushRAF();
      await flushRAF();

      await expect(promise).resolves.toBe('truthy');
    }, 1000);

    it('should treat undefined as falsy and continue polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 2 ? 'truthy' : undefined;
      };

      const waiter = new RequestAnimationFrameWaiter<string | undefined>(condition, 1000);
      const promise = waiter.waitForCondition();

      await flushRAF();
      await flushRAF();

      await expect(promise).resolves.toBe('truthy');
    }, 1000);

    it('should treat 0 as falsy and continue polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 2 ? 42 : 0;
      };

      const waiter = new RequestAnimationFrameWaiter<number>(condition, 1000);
      const promise = waiter.waitForCondition();

      await flushRAF();
      await flushRAF();

      await expect(promise).resolves.toBe(42);
    }, 1000);

    it('should treat empty string as falsy and continue polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 2 ? 'result' : '';
      };

      const waiter = new RequestAnimationFrameWaiter<string>(condition, 1000);
      const promise = waiter.waitForCondition();

      await flushRAF();
      await flushRAF();

      await expect(promise).resolves.toBe('result');
    }, 1000);

    it('should treat false as falsy and continue polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 2 ? true : false;
      };

      const waiter = new RequestAnimationFrameWaiter<boolean>(condition, 1000);
      const promise = waiter.waitForCondition();

      await flushRAF();
      await flushRAF();

      await expect(promise).resolves.toBe(true);
    }, 1000);
  });

  describe('cancel', () => {
    it('should cancel the wait and reject with cancellation error', async () => {
      const condition = () => false;
      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      
      const promise = waiter.waitForCondition();

      await flushRAF();
      waiter.cancel();
      await flushRAF();

      await expect(promise).rejects.toThrow('Wait cancelled');
    }, 1000);

    it('should prevent further condition checks after cancellation', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      const promise = waiter.waitForCondition();

      await flushRAF();
      expect(callCount).toBe(1);

      await flushRAF();
      expect(callCount).toBe(2);

      waiter.cancel();
      
      // Flush more frames - no more checks should happen
      await flushRAF();
      await flushRAF();
      expect(callCount).toBe(2);

      await expect(promise).rejects.toThrow('Wait cancelled');
    }, 1000);

    it('should be safe to call cancel multiple times', async () => {
      const condition = () => false;
      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      
      const promise = waiter.waitForCondition();
      
      // Let the first check run
      await Promise.resolve();
      await Promise.resolve();

      waiter.cancel();
      waiter.cancel();
      waiter.cancel();
      
      await flushRAF();

      await expect(promise).rejects.toThrow('Wait cancelled');
    }, 1000);

    it('should cancel immediately without waiting', async () => {
      const condition = () => false;
      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      
      const promise = waiter.waitForCondition();
      
      // Let the first check run
      await Promise.resolve();
      await Promise.resolve();
      
      waiter.cancel();
      
      // Need to flush RAF to allow the checkCondition to see the cancelled flag
      await flushRAF();

      await expect(promise).rejects.toThrow('Wait cancelled');
    }, 1000);

    it('should call cancelAnimationFrame on cancel', async () => {
      const condition = () => false;
      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      
      const promise = waiter.waitForCondition();
      
      // Let the first check run and schedule a RAF
      await Promise.resolve();
      await Promise.resolve();
      
      waiter.cancel();
      await flushRAF();

      expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
      await expect(promise).rejects.toThrow('Wait cancelled');
    }, 1000);
  });

  describe('multiple waitForCondition calls', () => {
    it('should reset state when calling waitForCondition again', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 2 || callCount === 4 ? 'done' : false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 1000);

      // First wait
      const promise1 = waiter.waitForCondition();
      await flushRAF();
      await flushRAF();
      await expect(promise1).resolves.toBe('done');
      expect(callCount).toBe(2);

      // Second wait should work independently
      const promise2 = waiter.waitForCondition();
      await flushRAF();
      await flushRAF();
      await expect(promise2).resolves.toBe('done');
      expect(callCount).toBe(4);
    }, 1000);

    it('should reset cancelled flag on new waitForCondition call', async () => {
      let firstWait = true;
      const condition = () => {
        return firstWait ? false : 'success';
      };
      const waiter = new RequestAnimationFrameWaiter(condition, 1000);

      // First wait - cancel it immediately
      const promise1 = waiter.waitForCondition();
      
      // Let first check run
      await Promise.resolve();
      await Promise.resolve();
      
      waiter.cancel();
      await flushRAF();
      await expect(promise1).rejects.toThrow('Wait cancelled');

      // Second wait - should work normally
      firstWait = false;
      const promise2 = waiter.waitForCondition();
      await flushRAF();
      await expect(promise2).resolves.toBe('success');
    }, 1000);
  });

  describe('condition guaranteed to run at least once', () => {
    it('should run condition at least once even with zero timeout', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 0);
      const promise = waiter.waitForCondition();
      
      await flushRAF();
      
      await expect(promise).rejects.toThrow('Timeout after 0ms');
      expect(callCount).toBe(1);
    }, 1000);

    it('should return truthy result from first check even with zero timeout', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return 'immediate success';
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 0);
      const promise = waiter.waitForCondition();
      
      await flushRAF();
      
      await expect(promise).resolves.toBe('immediate success');
      expect(callCount).toBe(1);
    }, 1000);

    it('should run condition at least once even if it throws with zero timeout', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        throw new Error('Test error');
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 0);
      const promise = waiter.waitForCondition();
      
      await flushRAF();
      
      await expect(promise).rejects.toThrow('Timeout after 0ms');
      expect(callCount).toBe(1);
    }, 1000);

    it('should run async condition at least once with zero timeout', async () => {
      let callCount = 0;
      const condition = async () => {
        callCount++;
        await Promise.resolve();
        return false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 0);
      const promise = waiter.waitForCondition();
      
      await flushRAF();
      
      await expect(promise).rejects.toThrow('Timeout after 0ms');
      expect(callCount).toBe(1);
    }, 1000);
  });

  describe('edge cases and stress tests', () => {
    it('should handle condition that becomes true immediately', async () => {
      const condition = () => 'immediate';
      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      
      const promise = waiter.waitForCondition();
      await flushRAF();

      await expect(promise).resolves.toBe('immediate');
    }, 1000);

    it('should handle very large timeout values', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 3 ? 'done' : false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, Number.MAX_SAFE_INTEGER);
      const promise = waiter.waitForCondition();

      await flushRAF();
      await flushRAF();
      await flushRAF();

      await expect(promise).resolves.toBe('done');
    }, 1000);

    it('should handle zero timeout', async () => {
      const condition = () => false;
      const waiter = new RequestAnimationFrameWaiter(condition, 0);
      
      const promise = waiter.waitForCondition();
      await flushRAF();

      await expect(promise).rejects.toThrow('Timeout after 0ms');
    }, 1000);

    it('should handle many rapid condition checks', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 10 ? 'done' : false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      const promise = waiter.waitForCondition();

      // Trigger 10 frames
      for (let i = 0; i < 10; i++) {
        await flushRAF();
      }

      await expect(promise).resolves.toBe('done');
      expect(callCount).toBe(10);
    }, 1000);

    it('should handle condition that alternates between truthy and falsy (first truthy wins)', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        // Returns truthy on odd calls
        return callCount % 2 === 1 ? `call-${callCount}` : false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      const promise = waiter.waitForCondition();

      // First check happens immediately and should return truthy
      await flushRAF();

      await expect(promise).resolves.toBe('call-1');
      expect(callCount).toBe(1);
    }, 1000);

    it('should handle async condition with delayed resolution', async () => {
      let callCount = 0;
      const condition = async () => {
        await Promise.resolve(); // Async work
        callCount++;
        return callCount === 3 ? 'done' : false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      const promise = waiter.waitForCondition();

      // Need extra delays for async conditions
      await flushRAF();
      await Promise.resolve();
      await Promise.resolve();
      
      await flushRAF();
      await Promise.resolve();
      await Promise.resolve();
      
      await flushRAF();
      await Promise.resolve();
      await Promise.resolve();

      await expect(promise).resolves.toBe('done');
      expect(callCount).toBe(3);
    }, 1000);

    it('should properly cleanup RAF on success', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 2 ? 'success' : false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      const promise = waiter.waitForCondition();

      await flushRAF();
      await flushRAF();

      await expect(promise).resolves.toBe('success');
      
      // No more RAF callbacks should be scheduled after success
      expect(rafCallbacks.length).toBe(0);
    }, 1000);

    it('should properly cleanup RAF on timeout', async () => {
      const condition = () => false;
      const waiter = new RequestAnimationFrameWaiter(condition, 50);
      const promise = waiter.waitForCondition();

      const startTime = performance.now();
      while (performance.now() - startTime < 100) {
        await flushRAF();
      }

      await expect(promise).rejects.toThrow('Timeout after 50ms');
      
      // No more RAF callbacks should be scheduled after timeout
      expect(rafCallbacks.length).toBe(0);
    }, 1000);
  });

  describe('performance.now() integration', () => {
    it('should use performance.now() for timeout calculation', async () => {
      const performanceNowSpy = vi.spyOn(performance, 'now');
      
      const condition = () => 'done';
      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      const promise = waiter.waitForCondition();

      await flushRAF();

      await expect(promise).resolves.toBe('done');
      
      // Should have called performance.now() at least once
      expect(performanceNowSpy).toHaveBeenCalled();
    }, 1000);

    it('should check timeout against performance.now()', async () => {
      const checkTimes: number[] = [];
      const condition = () => {
        checkTimes.push(performance.now());
        return false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 100);
      const promise = waiter.waitForCondition();

      const startTime = performance.now();
      while (performance.now() - startTime < 150) {
        await flushRAF();
      }

      await expect(promise).rejects.toThrow('Timeout after 100ms');
      
      // Verify that checks happened and timeout was enforced
      expect(checkTimes.length).toBeGreaterThan(1);
    }, 1000);
  });

  describe('Waiter interface compliance', () => {
    it('should implement waitForCondition method', () => {
      const condition = () => true;
      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      
      expect(waiter.waitForCondition).toBeDefined();
      expect(typeof waiter.waitForCondition).toBe('function');
    });

    it('should implement cancel method', () => {
      const condition = () => true;
      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      
      expect(waiter.cancel).toBeDefined();
      expect(typeof waiter.cancel).toBe('function');
    });

    it('waitForCondition should return a Promise', async () => {
      const condition = () => true;
      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      
      const result = waiter.waitForCondition();
      expect(result).toBeInstanceOf(Promise);
      
      // Clean up
      await flushRAF();
      return result;
    }, 1000);
  });

  describe('requestAnimationFrame usage', () => {
    it('should use requestAnimationFrame for polling', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 3 ? 'done' : false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      const promise = waiter.waitForCondition();

      expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(0);

      await flushRAF();
      expect(globalThis.requestAnimationFrame).toHaveBeenCalled();

      await flushRAF();
      await flushRAF();

      await expect(promise).resolves.toBe('done');
      expect(callCount).toBe(3);
    }, 1000);

    it('should not pause between RAF calls', async () => {
      let callCount = 0;
      const condition = () => {
        callCount++;
        return callCount === 5 ? 'done' : false;
      };

      const waiter = new RequestAnimationFrameWaiter(condition, 1000);
      const promise = waiter.waitForCondition();

      // Should be able to trigger multiple checks in quick succession
      for (let i = 0; i < 5; i++) {
        await flushRAF();
      }

      await expect(promise).resolves.toBe('done');
      expect(callCount).toBe(5);
    }, 1000);
  });
});
