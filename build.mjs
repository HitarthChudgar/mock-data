import * as esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const watch = process.argv.includes("--watch");

const pluginOptions = {
  entryPoints: ["src/plugin/main.ts"],
  bundle: true,
  outfile: "code.js",
  target: "es2020",
  format: "iife",
  logLevel: "info",
};

const uiOptions = {
  entryPoints: ["src/ui/ui.ts"],
  bundle: true,
  write: false,
  target: "es2020",
  format: "iife",
  logLevel: "info",
};

function writeUi(result) {
  const js = result.outputFiles[0].text;
  const css = readFileSync("src/ui/styles.css", "utf8");
  const html = readFileSync("src/ui/index.html", "utf8")
    .replace("/* INJECT_CSS */", css)
    .replace("// INJECT_JS", js);
  writeFileSync("ui.html", html);
}

async function buildUi() {
  const result = await esbuild.build(uiOptions);
  writeUi(result);
}

async function buildAll() {
  await esbuild.build(pluginOptions);
  await buildUi();
}

if (watch) {
  const pluginCtx = await esbuild.context({
    ...pluginOptions,
    plugins: [
      {
        name: "rebuild-ui",
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length === 0) {
              try {
                await buildUi();
              } catch (error) {
                console.error(error);
              }
            }
          });
        },
      },
    ],
  });
  await pluginCtx.watch();
  const uiCtx = await esbuild.context({
    ...uiOptions,
    write: true,
    outfile: "out/ui.js",
    plugins: [
      {
        name: "html",
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length === 0) {
              try {
                await buildUi();
              } catch (error) {
                console.error(error);
              }
            }
          });
        },
      },
    ],
  });
  await uiCtx.watch();
  console.log("Watching…");
} else {
  await buildAll();
}
