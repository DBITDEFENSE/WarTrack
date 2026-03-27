import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['wartrack/tests/**/*.test.js'],
  },
});
