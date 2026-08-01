import { defineConfig } from 'vitest/config';

// Dedicated config for the headless simulation benchmark. It is separate from the
// default unit suite so benchmark runs never interfere with `npm test` and can
// use a longer timeout for the 50v50 workload.
export default defineConfig({
  test: {
    include: ['bench/**/*.bench.test.ts'],
    testTimeout: 180000,
    hookTimeout: 180000,
    // Send the benchmark report straight to stdout instead of buffering it.
    disableConsoleIntercept: true
  }
});
