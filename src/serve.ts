import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import * as path from "https://deno.land/std@0.181.0/path/mod.ts";
import {
  BUILD_FOLDER,
  bundle,
  getCurrentDate,
  getCurrentFilePath,
} from "./utils.ts";
import { open } from "https://deno.land/x/open@v0.0.6/index.ts";

type Props = {
  port?: number;
  envs?: string[];
  indexFileName?: string;
  minify?: boolean;
  externals?: string[];
  bundleAssets?: boolean;
  plugins?: string[]
};

type ServeProps = {
  port?: number;
  envs?: string[];
} & Props;

type ChecksumType = {
  index: string | null;
  bundle: string | null;
  styles: string | null;
};

export const build = ({
  indexFileName = "main.tsx",
  envs = [],
  minify = false,
  externals = [],
  bundleAssets = false,
                        plugins = []
}: Props): Promise<void> =>
  bundle(indexFileName, JSON.stringify(envs), minify, externals, bundleAssets, plugins);

export const webServe = async (
  {
    port = 8080,
    indexFileName = "main.tsx",
    minify = true,
    externals = [],
    envs = ["ENVIRONMENT"],
    bundleAssets = false,
    plugins = []
  }: ServeProps,
) => {
  const currentBuildPath = path.join(await Deno.cwd(), BUILD_FOLDER);
  const isDevelopment = Deno.env.get("ENVIRONMENT")! === "DEVELOPMENT";

  const socketList: (WebSocket | undefined)[] = [];

  const DevelopmentFunctions = (() => {
    if (!isDevelopment) return undefined;

    console.clear();
    console.log(">>> DEVELOPMENT MODE <<<");

    const sendUpdateToClients = () => {
      const socketClientList = socketList.filter((ws?: WebSocket) =>
        ws && ws?.readyState === ws.OPEN
      );
      console.log(
        `[${getCurrentDate()}] Sending changes to clients (${socketClientList.length})`,
      );
      socketClientList.forEach((ws: WebSocket) => ws.send("reload"));
    };

    const onRequestWebSocket = (request: Request) => {
      if (request.headers.get("upgrade") === "websocket") {
        const { socket: ws, response } = Deno.upgradeWebSocket(request);
        socketList.push(ws);
        return response;
      }
    };

    return {
      sendUpdateToClients,
      onRequestWebSocket,
    };
  })();

  if (isDevelopment) {
    setTimeout(() => {
      if (socketList.length === 0) {
        open(`http://localhost:${port}`);
      }
    }, 1000);
    
    const environments = envs.reduce(
      (obj, key) => ({ ...obj, [key]: Deno.env.get(key) }),
      {},
    );
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        "--watch=src/,public/",
        getCurrentFilePath("bundler.ts"),
        `--indexFileName=${indexFileName}`,
        `--envs=${JSON.stringify(environments)}`,
        `--minify=${minify}`,
        externals?.length ? `--externals=${externals.join(",")}` : "",
        `--mixAllInsideIndex=${bundleAssets}`,
        plugins?.length ? `--plugins=${plugins.join(',')}` : ""
      ],
    });
    command.spawn();
  }

  await serve(
    async (request: Request) => {
      const webSocketResponse = DevelopmentFunctions?.onRequestWebSocket(
        request,
      );
      if (webSocketResponse) return webSocketResponse;

      const url = new URL(request.url);
      const filepath = url.pathname ? decodeURIComponent(url.pathname) : "";

      let file;
      if (isDevelopment && filepath === "/_bundler") {
        DevelopmentFunctions?.sendUpdateToClients()
        return new Response();
      }
      if (filepath !== "/") {
        try {
          file = await Deno.open(currentBuildPath + filepath, { read: true });
        } catch {
          // ignore
        }
      }

      if (!file) {
        if (filepath?.split("/")?.pop()?.includes(".")) {
          return new Response("404 Not Found", { status: 404 });
        }

        const indexFileText = await Deno.readTextFile(
          currentBuildPath + "index.html",
        );

        return new Response(indexFileText, {
          headers: {
            "content-type": "text/html",
          },
        });
      }

      return new Response(file?.readable);
    },
    { port },
  );
};
