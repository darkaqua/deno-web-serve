
export const denoLoaderPlugin = () => {
  const externalsCode: Record<string, Uint8Array> = {}

  const onResolve = (args) => {
    try {
      const command = new Deno.Command(Deno.execPath(), {
        args: ["bundle", args.path],
      });

      const { stdout } = command.outputSync();
      externalsCode[args.path] = stdout
      return {
        path: args.path,
        namespace: "deno-loader"
      }
    } catch (e) {
      console.error(`Error descargando "${args.path}": ${e.message}`);
      return null;
    }
  };

  const onLoad = (args) => {
    return {
      contents: externalsCode[args.path],
      loader: "js",
    };
  }

  const setup = (build) => {
    build.onResolve({ filter: /^https?:\/\// }, onResolve);
    build.onLoad({ filter: /.*/, namespace: "deno-loader" }, onLoad);
  }

  return {
    name: "deno-loader",
    setup,
  }
}
