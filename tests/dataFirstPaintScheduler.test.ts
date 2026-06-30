import assert from "node:assert/strict";
import { scheduleDataWorkAfterFirstPaint } from "../src/features/data/services/dataFirstPaintScheduler.ts";

type FrameCallback = () => void;

function installFakeWindow() {
  const globalWithWindow = globalThis as unknown as { window?: unknown };
  const previousWindow = globalWithWindow.window;
  let nextHandle = 1;
  const frames = new Map<number, FrameCallback>();
  const idleCallbacks = new Map<number, FrameCallback>();
  const timeouts = new Map<number, FrameCallback>();
  const fakeWindow = {
    requestAnimationFrame(callback: FrameCallback) {
      const handle = nextHandle;
      nextHandle += 1;
      frames.set(handle, callback);
      return handle;
    },
    cancelAnimationFrame(handle: number) {
      frames.delete(handle);
    },
    requestIdleCallback(callback: FrameCallback) {
      const handle = nextHandle;
      nextHandle += 1;
      idleCallbacks.set(handle, callback);
      return handle;
    },
    cancelIdleCallback(handle: number) {
      idleCallbacks.delete(handle);
    },
    setTimeout(callback: FrameCallback) {
      const handle = nextHandle;
      nextHandle += 1;
      timeouts.set(handle, callback);
      return handle;
    },
    clearTimeout(handle: number) {
      timeouts.delete(handle);
    },
  };
  globalWithWindow.window = fakeWindow;

  return {
    runNextFrame() {
      const [handle, callback] = frames.entries().next().value ?? [];
      if (!handle || !callback) return false;
      frames.delete(handle);
      callback();
      return true;
    },
    runNextIdle() {
      const [handle, callback] = idleCallbacks.entries().next().value ?? [];
      if (!handle || !callback) return false;
      idleCallbacks.delete(handle);
      callback();
      return true;
    },
    runNextTimeout() {
      const [handle, callback] = timeouts.entries().next().value ?? [];
      if (!handle || !callback) return false;
      timeouts.delete(handle);
      callback();
      return true;
    },
    restore() {
      if (previousWindow === undefined) {
        delete globalWithWindow.window;
      } else {
        globalWithWindow.window = previousWindow;
      }
    },
  };
}

let passed = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

await runTest("data first paint scheduler waits for two frames before idle work", () => {
  const fakeWindow = installFakeWindow();
  let calls = 0;

  try {
    scheduleDataWorkAfterFirstPaint(() => {
      calls += 1;
    });

    assert.equal(calls, 0);
    assert.equal(fakeWindow.runNextFrame(), true);
    assert.equal(calls, 0);
    assert.equal(fakeWindow.runNextFrame(), true);
    assert.equal(calls, 0);
    assert.equal(fakeWindow.runNextIdle(), true);
    assert.equal(calls, 1);
  } finally {
    fakeWindow.restore();
  }
});

await runTest("data first paint scheduler can delay idle work after first paint", () => {
  const fakeWindow = installFakeWindow();
  let calls = 0;

  try {
    scheduleDataWorkAfterFirstPaint(() => {
      calls += 1;
    }, 800, 120);

    assert.equal(fakeWindow.runNextFrame(), true);
    assert.equal(fakeWindow.runNextFrame(), true);
    assert.equal(calls, 0);
    assert.equal(fakeWindow.runNextIdle(), false);
    assert.equal(fakeWindow.runNextTimeout(), true);
    assert.equal(calls, 0);
    assert.equal(fakeWindow.runNextIdle(), true);
    assert.equal(calls, 1);
  } finally {
    fakeWindow.restore();
  }
});

await runTest("data first paint scheduler cancels queued work", () => {
  const fakeWindow = installFakeWindow();
  let calls = 0;

  try {
    const cancel = scheduleDataWorkAfterFirstPaint(() => {
      calls += 1;
    });

    assert.equal(fakeWindow.runNextFrame(), true);
    cancel();
    assert.equal(fakeWindow.runNextFrame(), false);
    assert.equal(fakeWindow.runNextIdle(), false);
    assert.equal(fakeWindow.runNextTimeout(), false);
    assert.equal(calls, 0);
  } finally {
    fakeWindow.restore();
  }
});

console.log(`Passed ${passed} data first paint scheduler tests`);
