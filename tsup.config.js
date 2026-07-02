import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.js"],
  format: ["esm", "cjs"],
  dts: false, // hand-written src/index.d.ts is copied instead, see onSuccess
  sourcemap: true,
  clean: true,
  minify: true,
  onSuccess: "cp src/index.d.ts dist/index.d.ts",
});
