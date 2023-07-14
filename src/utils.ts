export const PUBLIC_FOLDER = "public/";
export const BUILD_FOLDER = "build/";

export const getCurrentFilePathLOCAL = (fileName: string) =>
  Deno.realPathSync(new URL(import.meta.url))
    .replace(/\w*.ts/gm, fileName);

export const getCurrentFilePath = (fileName: string) =>
  new URL(import.meta.url).href
    .replace(/\w*.ts/gm, fileName);

export const copyDirRecursive = async (
  srcDir: string,
  destDir: string,
  ignoreFiles: string[] = [],
) => {
  await Deno.mkdir(destDir, { recursive: true });

  for await (const dirEntry of Deno.readDir(srcDir)) {
    const srcPath = `${srcDir}/${dirEntry.name}`;
    const destPath = `${destDir}/${dirEntry.name}`;

    if (!ignoreFiles.includes(dirEntry.name)) {
      if (dirEntry.isFile) {
        await Deno.copyFile(srcPath, destPath);
      } else if (dirEntry.isDirectory) {
        await copyDirRecursive(srcPath, destPath);
      } else {
        console.warn(`Skipping unsupported directory entry: ${dirEntry.name}`);
      }
    }
  }
};

export const bundle = async (
  indexFileName: string,
  envs: string,
  minify: boolean,
  externals: string[],
  mixAllInsideIndex: boolean,
) => {
  const environments = JSON.parse(envs).reduce(
    (obj, key) => ({ ...obj, [key]: Deno.env.get(key) }),
    {},
  );
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      getCurrentFilePath("bundler.ts"),
      `--indexFileName=${indexFileName}`,
      `--envs=${JSON.stringify(environments)}`,
      `--minify=${minify}`,
      externals?.length ? `--externals=${externals.join(",")}` : "",
      `--mixAllInsideIndex=${mixAllInsideIndex}`,
    ],
  });

  const { code, stdout, stderr } = command.outputSync();
  console.log(code === 0 ? "Done!" : undefined);
  if (stdout.length) {
    console.log(new TextDecoder().decode(stdout));
  }
  if (stderr.length) {
    console.error(new TextDecoder().decode(stderr));
  }
};

export const getCurrentDate = () => {
  const now = new Date();

  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  const milliseconds = now.getMilliseconds().toString().padStart(3, "0");

  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
};

export async function getFilesRecursively(path: string): Promise<string[]> {
  const files: string[] = [];

  for await (const entry of Deno.readDir(path)) {
    const entryPath = `${path}/${entry.name}`;

    if (entry.isDirectory) {
      const nestedFiles = await getFilesRecursively(entryPath);
      files.push(...nestedFiles);
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

export async function pngToBase64(filePath: string): Promise<string> {
  const data = await Deno.readFile(filePath);
  const base64 = btoa(String.fromCharCode(...data));
  return `data:image/png;base64,${base64}`;
}
