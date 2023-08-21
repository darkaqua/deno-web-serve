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
        const srcFileInfo = await Deno.stat(srcPath);
        const destFileInfo = await getFileInfo(destPath);
        
        if (!destFileInfo || shouldCopyFile(srcFileInfo, destFileInfo)) {
          await Deno.copyFile(srcPath, destPath);
        }
      } else if (dirEntry.isDirectory) {
        await copyDirRecursive(srcPath, destPath);
      } else {
        console.warn(`Skipping unsupported directory entry: ${dirEntry.name}`);
      }
    }
  }
};

const getFileInfo = async (path: string): Promise<Deno.FileInfo | null> => {
  try {
    return await Deno.stat(path);
  } catch (error) {
    // If the file doesn't exist, stat will throw an error.
    // We catch the error and return null instead.
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    throw error;
  }
};

const shouldCopyFile = (srcInfo: Deno.FileInfo, destInfo: Deno.FileInfo | null): boolean => (
  // Check if the destination file doesn't exist.
  !destInfo ||
  // Check if the source file has been modified more recently than the destination file.
  srcInfo.mtime?.getTime()! > destInfo?.mtime?.getTime()! ||
  // Check if the source file size is different from the destination file size.
  srcInfo.size !== destInfo?.size
)

export const bundle = (
  indexFileName: string,
  envs: string,
  minify: boolean,
  externals: string[],
  mixAllInsideIndex: boolean,
  plugins: string[]
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
      plugins?.length ? `--plugins=${plugins.join(',')}` : ""
    ],
  });
  
  console.log('???')
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
