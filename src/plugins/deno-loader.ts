
export const denoLoaderPlugin = () => {
  const externalsCode: Record<string, Uint8Array> = {}

  return {
    name: "deno-loader",
    setup(build: any) {
      build.onResolve({ filter: /^https?:\/\// }, (args: any) => {
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
      });

      build.onLoad({ filter: /.*/, namespace: "deno-loader" }, (args) => {
        return {
          contents: externalsCode[args.path],
          loader: "js",
        };
      });
    }
  }

}
