import { test } from 'vitest';
import type { TestFunction } from 'vitest';

export function isNativeDom(): boolean {
  return Object.getOwnPropertyDescriptor(globalThis, 'window')?.get?.toString().includes('[native code]') ?? false;
}

export function testIf(condition: boolean, name: string, fn: TestFunction, timeout?: number): void {
  if (timeout !== undefined) {
    condition ? test(name, fn, timeout) : test.skip(name, fn, timeout);
  } else {
    condition ? test(name, fn) : test.skip(name, fn);
  }
}
