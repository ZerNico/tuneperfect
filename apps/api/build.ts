await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "bun",
  format: "esm",
  env: "disable",
  external: ["sharp"],
});
