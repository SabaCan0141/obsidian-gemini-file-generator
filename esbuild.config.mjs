// esbuild.config.mjs
import esbuild from "esbuild";
import process from "process";

const isProd = process.argv.includes("--production");

esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "main.js",
  external: ["obsidian"],      // ★必須：Obsidian API はバンドルしない
  format: "cjs",               // ★必須：CommonJS
  target: "es2018",
  sourcemap: !isProd,
  minify: isProd,
  treeShaking: true,
  logLevel: "info"
}).catch(() => process.exit(1));
