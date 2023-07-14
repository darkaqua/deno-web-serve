import esbuild from "npm:esbuild@0.17.0";
import { ScssModulesPlugin } from "npm:esbuild-scss-modules-plugin@1.1.1";
import svgrPlugin from "npm:esbuild-plugin-svgr@1.1.0";
import {
  BUILD_FOLDER,
  copyDirRecursive,
  getFilesRecursively,
  pngToBase64,
  PUBLIC_FOLDER,
} from "./utils.ts";
import { parse } from "https://deno.land/std@0.182.0/flags/mod.ts";
import { default as externalGlobalPlugin } from "npm:esbuild-plugin-external-global";

const {
  indexFileName,
  envs: _envs,
  minify: _minify,
  externals,
  mixAllInsideIndex: _mixAllInsideIndex,
} = parse(Deno.args);

const envs = JSON.parse(_envs);
const minify = _minify === "true";
const mixAllInsideIndex = _mixAllInsideIndex === "true";

const isDevelopment = envs?.ENVIRONMENT === "DEVELOPMENT";

let developmentHotRefresh;

if (isDevelopment) {
  const developmentHotRefreshUrl =
    "https://raw.githubusercontent.com/pagoru/deno-web-serve/master/src/development-hot-refresh.js";
  const developmentHotRefreshResponse = await fetch(developmentHotRefreshUrl);
  developmentHotRefresh = await developmentHotRefreshResponse.text();
}

let indexFileText = await Deno.readTextFile(`./${PUBLIC_FOLDER}index.html`);

try {
  let cssData = "";
  const bundleText = await esbuild.build({
    entryPoints: [`./src/${indexFileName}`],
    bundle: true,
    write: !mixAllInsideIndex,
    outfile: mixAllInsideIndex ? undefined : `./${BUILD_FOLDER}bundle.js`,
    minify: minify,
    plugins: [
      ScssModulesPlugin({
        inject: false,
        minify: minify,
        cssCallback: (css) => cssData += css,
      }),
      svgrPlugin(),
      externalGlobalPlugin.externalGlobalPlugin(
        externals
          ? ((externals.split(",")) as []).reduce((obj, key: string) => ({
            ...obj,
            [key]: `window.${key.replace(/-/, "")}`,
          }), {})
          : {},
      ),
    ],
  });

  indexFileText = indexFileText.replace(
    /<!-- SCRIPT_ENVS -->/,
    `<script type="text/javascript">
      window.__env__ = ${JSON.stringify(envs)}
    </script>`,
  );

  if (mixAllInsideIndex) {
    indexFileText = indexFileText.replace(
      /<!-- SCRIPT_BUNDLE -->/,
      `<script type="text/javascript">
        const fetch = (async (data) => ({ json: async () => data }));
        ${bundleText.outputFiles[0].text}
        </script>`,
    );
    if (cssData) {
      indexFileText = indexFileText.replace(
        /<!-- STYLES_FILE -->/,
        `<style>${cssData}</style>`,
      );
    }
    //
  } else {
    indexFileText = indexFileText.replace(
      /<!-- SCRIPT_BUNDLE -->/,
      `<script type="text/javascript" src="/bundle.js"></script>`,
    );
    if (cssData) {
      Deno.writeTextFileSync(`./${BUILD_FOLDER}styles.css`, cssData);
    }
  }

  if (isDevelopment) {
    indexFileText = indexFileText.replace(
      /<!-- SCRIPT_FOOTER -->/,
      `<script type="text/javascript">\n${developmentHotRefresh}</script>`,
    );
  }
} catch (e) {
  console.error(e);
}

try {
  await copyDirRecursive(PUBLIC_FOLDER, BUILD_FOLDER, ["index.html"]);
  const assetsDir = `./${PUBLIC_FOLDER}/assets`;
  const buildAssetsDir = `./${BUILD_FOLDER}assets`;

  if (mixAllInsideIndex) {
    const assetsList = await getFilesRecursively(assetsDir);

    await Promise.all(assetsList.map(async (assetFilePath) => {
      const assetCleanFilePath = assetFilePath.replace("./src/", "");
      if (assetFilePath.includes(".png")) {
        indexFileText = indexFileText.replace(
          assetCleanFilePath,
          await pngToBase64(assetFilePath),
        );
      } else if (assetFilePath.includes(".json")) {
        const jsonText = await Deno.readTextFile(assetFilePath);
        indexFileText = indexFileText.replace(
          `\"${assetCleanFilePath}\"`,
          jsonText,
        );
      }
    }));
  } else {
    await copyDirRecursive(assetsDir, buildAssetsDir);
  }
} catch (err) {
  console.error(err);
}

const indexFilePath = `./${BUILD_FOLDER}index.html`;
Deno.writeTextFileSync(indexFilePath, indexFileText);
