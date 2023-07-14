import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import * as path from "https://deno.land/std@0.181.0/path/mod.ts";
import {
  BUILD_FOLDER,
  bundle,
  getCurrentDate,
  getCurrentFilePath,
} from "./utils.ts";
import { open } from "https://deno.land/x/open/index.ts";

type Props = {
  port?: number;
  envs?: string[];
  indexFileName?: string;
  minify?: boolean;
  externals?: string[];
  mixAllInsideIndex?: boolean;
};

type ServeProps = {
  port?: number;
  envs?: string[];
} & Props;

type ChecksumType = {
  index: string | undefined;
  bundle: string | undefined;
  styles: string | undefined;
};

export const build = ({
  indexFileName = "main.tsx",
  envs = [],
  minify = false,
  externals = [],
  mixAllInsideIndex = false,
}: Props): Promise<void> =>
  bundle(indexFileName, envs, minify, externals, mixAllInsideIndex);

export const webServe = async (
  {
    port = 8080,
    indexFileName = "main.tsx",
    minify = true,
    externals = [],
    envs = ["ENVIRONMENT"],
    mixAllInsideIndex = false,
  }: ServeProps,
) => {
  const currentBuildPath = path.join(await Deno.cwd(), BUILD_FOLDER);
  const isDevelopment = Deno.env.get("ENVIRONMENT")! === "DEVELOPMENT";

  const socketList: (WebSocket | undefined)[] = [];

  const DevelopmentFunctions = (() => {
    if (!isDevelopment) return undefined;

    console.clear();
    console.log(">>> DEVELOPMENT MODE <<<");

    const getFileChecksum = async (fileName: string) => {
      const bundleText = await Deno.readTextFile(currentBuildPath + fileName);

      const data = new TextEncoder().encode(bundleText);
      const digest = await crypto.subtle.digest("sha-256", data.buffer);
      return new TextDecoder().decode(new Uint8Array(digest));
    };

    const sendUpdateToClients = () => {
      const socketClientList = socketList.filter((ws?: WebSocket) =>
        ws && ws?.readyState === ws.OPEN
      );
      console.log(
        `[${getCurrentDate()}] Sending changes to clients (${socketClientList.length})`,
      );
      socketClientList.forEach((ws: WebSocket) => ws.send("reload"));
    };

    let lastChecksums: ChecksumType = {
      index: undefined,
      bundle: undefined,
      styles: undefined,
    };

    setInterval(async () => {
      const targetChecksums: ChecksumType = {
        index: undefined,
        bundle: undefined,
        styles: undefined,
      };
      try {
        if (mixAllInsideIndex) {
          targetChecksums.index = await getFileChecksum("index.html");
        } else {
          targetChecksums.bundle = await getFileChecksum("bundle.js");
          targetChecksums.styles = await getFileChecksum("styles.css");
        }
      } catch (e) {}
      if (
        mixAllInsideIndex
          ? (lastChecksums.index &&
            lastChecksums.index !== targetChecksums.index)
          : (
            (lastChecksums.bundle &&
              lastChecksums.bundle !== targetChecksums.bundle) ||
            (lastChecksums.styles &&
              lastChecksums.styles !== targetChecksums.styles)
          )
      ) {
        
        console.log('send!')
        sendUpdateToClients();
      }

      lastChecksums = targetChecksums;
    }, 50);

    const onRequestWebSocket = (request: Request) => {
      if (request.headers.get("upgrade") === "websocket") {
        const { socket: ws, response } = Deno.upgradeWebSocket(request);
        socketList.push(ws);
        ws.onmessage = (m) => console.log(m);
        return response;
      }
    };

    return {
      onRequestWebSocket,
    };
  })();

  if (isDevelopment) {
    setTimeout(() => {
      if (socketList.length === 0) {
        open(`http://localhost:${port}`);
      }
    }, 1000);

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        "--watch=src/",
        getCurrentFilePath("bundlerWatcher.ts"),
        `--indexFileName=${indexFileName}`,
        `--envs=${JSON.stringify(envs)}`,
        `--minify=${minify}`,
        externals?.length ? `--externals=${externals.join(",")}` : "",
        `--mixAllInsideIndex=${mixAllInsideIndex}`,
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
      if (filepath !== "/") {
        try {
          file = await Deno.open(currentBuildPath + filepath, { read: true });
        } catch {
          // ignore
        }
      }

      if (!file) {
        if (filepath?.split("/")?.pop()?.includes("."))
          return new Response("404 Not Found", { status: 404 });
        
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
