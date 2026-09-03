import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": path.resolve(import.meta.dirname, "tests/support/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/support/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Các test HTTP dùng chung một server + một database — chạy tuần tự để
    // tránh đụng độ (vd nhiều test cùng sửa rate limiter/tạo user tạm).
    fileParallelism: false,
  },
});
