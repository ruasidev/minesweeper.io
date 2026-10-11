// Builds the board generator (crates/boardgen, in Rust) into the WebAssembly module the game runs, and puts it
// where the game loads it from: shared/engine/boardgen.wasm.ts.
//
//   npm run build:boardgen
//
// Run it after changing anything in crates/boardgen, and commit what it writes along with the change. The module
// is kept in the repository so that building the site or the API needs nothing but Node: neither GitHub Pages
// nor the API's image has a Rust compiler, and neither needs one.
//
// It is kept as text (base64, in a TypeScript file) rather than as a .wasm file because that is the one form the
// server, the browser and the tests all load the same way, with no bundler settings and no file to find at run time.

import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const root = new URL("../", import.meta.url)
const TARGET = "wasm32-unknown-unknown"
const LINE_LENGTH = 100

execFileSync("cargo", ["build", "--release", "--target", TARGET, "--package", "boardgen"], {
  cwd: fileURLToPath(root),
  stdio: "inherit",
})

const wasm = readFileSync(new URL(`target/${TARGET}/release/boardgen.wasm`, root))
const lines = wasm.toString("base64").match(new RegExp(`.{1,${LINE_LENGTH}}`, "g"))

const file = `// The board generator (crates/boardgen), built for WebAssembly and kept as base64: see boardgen.ts for what
// loads it. Written by \`npm run build:boardgen\`, which is the only way to change it

export default [
${lines.map(line => `  "${line}",`).join("\n")}
].join("")
`

writeFileSync(new URL("shared/engine/boardgen.wasm.ts", root), file)
console.log(`shared/engine/boardgen.wasm.ts: ${wasm.length} bytes of WebAssembly`)
