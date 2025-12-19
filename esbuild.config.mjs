import esbuild from "esbuild";
import process from "process";

const isProd = process.argv.includes("--production");

esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "main.js",
  external: ["obsidian"],
  format: "cjs",
  target: "es2018",
  sourcemap: !isProd,
  minify: isProd,
  treeShaking: true,
  logLevel: "info"
}).catch(() => process.exit(1));
