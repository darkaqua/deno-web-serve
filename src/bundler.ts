import esbuild from "npm:esbuild@0.20.0";
import { ScssModulesPlugin } from "npm:esbuild-scss-modules-plugin@1.1.1";
import svgrPlugin from "npm:esbuild-plugin-svgr@2.1.0";
import {
  BUILD_FOLDER,
  copyDirRecursive,
  getFilesRecursively,
  pngToBase64,
  PUBLIC_FOLDER,
} from "./utils.ts";
import { parse } from "https://deno.land/std@0.182.0/flags/mod.ts";
import { default as externalGlobalPlugin } from "npm:esbuild-plugin-external-global";
import dayjs from "npm:dayjs@1.11.9";
import {denoLoaderPlugin} from "./plugins/deno-loader.ts";

const getPrintableDatetime = () => dayjs().format('HH:mm:ss')

const startDatetime = Date.now();
const warningList: string[] = [];
const errorList: string[] = [];
const printConsole = (text: string, warning: boolean = false, error: boolean = false) => {
  const currentMs = Date.now() - startDatetime;
  if(error) errorList.push(text)
  else if(warning) warningList.push(text);
  console.log(`DWS - ${getPrintableDatetime()} - [`,currentMs, `ms ] ->`, warning ? `WARNING(${text})` : text)
}
const printDone = () => {
  const currentMs = Date.now() - startDatetime;
  // if(!errorList.length)
  //   console.clear()
  
  const thingsList = [...warningList, ...errorList];
  console.log(`DWS - ${getPrintableDatetime()} - [`,currentMs, `ms ] ->`, 'Bundled' , thingsList?.length === 0 ? `!` : `with the next warnings:`)
  thingsList.forEach(text => console.error('-', text))
}

printConsole('Start bundling!')

const {
  port,
  indexFileName,
  envs: _envs,
  minify: _minify,
  externals,
  mixAllInsideIndex: _mixAllInsideIndex,
  plugins: _plugins,
} = parse(Deno.args);

let plugins = [];
try {
  plugins = _plugins?.split(',');
} catch (e) {}

try {
  try {
    printConsole('Checking if build folder already exists')
    await Deno.stat(`./${BUILD_FOLDER}`)
  } catch (e) {
    printConsole('Trying to create the build folder')
    await Deno.mkdir(`./${BUILD_FOLDER}`)
  }
} catch (e) {
  printConsole('Impossible to create the build folder', true)
}


const envs = JSON.parse(_envs);
const minify = _minify === "true";
const mixAllInsideIndex = _mixAllInsideIndex === "true";

const isDevelopment = envs?.ENVIRONMENT === "DEVELOPMENT";

let developmentHotRefresh;
if (isDevelopment) {
  try {
    printConsole('Reading development-hot-refresh file from local')
    developmentHotRefresh = await (await (fetch(import.meta.url.replace('bundler.ts', 'development-hot-refresh.js')))).text();
  } catch (e) {
    printConsole('Impossible to read development-hot-refresh file from local', true)
  }
}

let indexFileText;
try {
  printConsole('Reading index.html from public folder')
  indexFileText = await Deno.readTextFile(`./${PUBLIC_FOLDER}index.html`);
} catch (e) {
  printConsole('Impossible to read index.html from public folder', true)
}

try {
  let cssData = "";
  printConsole(`Bundling ${indexFileName} from src folder`)
  
  const bundlePlugins = [
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
    plugins?.includes('deno-loader') ? denoLoaderPlugin() : undefined
  ].filter(Boolean);
  
  const bundleText = await esbuild.build({
    entryPoints: [`./src/${indexFileName}`, ],
    bundle: true,
    write: false,
    outfile: undefined,
    minify: minify,
    plugins: bundlePlugins as any,
  });
  printConsole(`Bundling complete!`)

  let bundle = bundleText.outputFiles[0].text;
  
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
        ${bundle}
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
    Deno.writeTextFileSync(`./${BUILD_FOLDER}bundle.js`, bundle)
    if (cssData) {
      printConsole(`Writing styles.css file to the build folder`)
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
  printConsole(`Something went extremely wrong during the bundler process!`, false, true)
}

try {
  const assetsDir = `./${PUBLIC_FOLDER}assets`;
  const buildAssetsDir = `./${BUILD_FOLDER}assets`;

  if (mixAllInsideIndex) {
    printConsole(`Reading recursively the assets public folder`)
    const assetsList = await getFilesRecursively(assetsDir);

    printConsole(`Processing assets from asets public folder`)
    await Promise.all(assetsList.map(async (assetFilePath) => {
      const assetCleanFilePath = assetFilePath.replace(`./${PUBLIC_FOLDER}`, "");
      if (assetFilePath.includes(".png")) {
        indexFileText = indexFileText.replaceAll(
          assetCleanFilePath,
          await pngToBase64(assetFilePath),
        );
      } else if (assetFilePath.includes(".json")) {
        const jsonText = await Deno.readTextFile(assetFilePath);
        indexFileText = indexFileText.replaceAll(
          `"${assetCleanFilePath}"`,
          jsonText,
        );
      }
    }));
  } else {
    printConsole(`Copying assets public folder to the build folder recursively`)
    await copyDirRecursive(assetsDir, buildAssetsDir);
  }
} catch (err) {
  printConsole(`Something went extremely wrong with the assets!`, true)
}

try {
  printConsole(`Writing index.html file to the build folder`)
  Deno.writeTextFileSync(`./${BUILD_FOLDER}index.html`, indexFileText);
} catch (e) {
  printConsole(`Impossible to write index.html file to the build folder`, true)
}

if(isDevelopment) {
  printConsole(`Calling bundler process for hot reload connected clients`)
  try {
    await (await fetch(`http://localhost:${port}/_bundler`)).text()
  } catch (e) {
    printConsole(`Impossible to call bundler process for hot reload connected clients`, true)
  }
}

printDone()
