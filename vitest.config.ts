import { defineConfig } from "vitest/config"

// The tests sit beside what they test, in the site (src/), the rules both sides share (shared/) and the server's
// own logic (server/src/). They run in Node; one that needs a page to work on says so at its head:
//   // @vitest-environment jsdom
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "shared/**/*.test.ts", "server/src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    // each test starts from mocks, timers and a page that nothing before it has touched
    restoreMocks: true,
    unstubGlobals: true,
  },
})
