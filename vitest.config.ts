import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@hearthline/domain": path.resolve("packages/domain/src/index.ts"),
      "@hearthline/application": path.resolve("packages/application/src/index.ts"),
    },
  },
});
