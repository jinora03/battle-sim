import { defineConfig } from 'vitest/config';

// The unit/determinism suite lives in tests/. The performance benchmark under
// bench/ is intentionally excluded here so `npm test` stays fast and never fails
// on wall-clock timing; run it explicitly with `npm run bench`.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts']
  }
});
