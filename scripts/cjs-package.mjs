import { writeFileSync } from "fs";

// Mark dist/cjs as a CommonJS scope so Node treats its .js files as CJS even
// though the root package is "type": "module".
writeFileSync(
  new URL("../dist/cjs/package.json", import.meta.url),
  JSON.stringify({ type: "commonjs" }) + "\n",
);
