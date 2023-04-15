import { serve } from 'https://deno.land/std@0.181.0/http/server.ts';
import * as path from "https://deno.land/std@0.181.0/path/mod.ts";
import {bundle, getCurrentDate, getCurrentFilePath} from "./utils.ts";
import { open } from 'https://deno.land/x/open/index.ts';

const watchPathProcess = (indexFileName: string) => {
	Deno.run({
		cmd: [
			'deno',
			'run',
			'-A',
			'--unstable',
			'--watch=src/',
			getCurrentFilePath('watcher.ts'),
			`--indexFileName=${indexFileName}`
		],
		stdout: 'piped',
		stderr: 'piped',
	});
}

export const build = (indexFileName?: string = 'main.tsx'): Promise<void> => bundle(indexFileName)

export const webServe = async (indexFileName?: string = 'main.tsx') => {
	const currentPublicPath = path.join(await Deno.cwd(), 'public/')
	const isDevelopment = Deno.env.get('ENVIRONMENT')! === 'DEVELOPMENT';
	
	const ENVIRONMENT_LIST = ["ENVIRONMENT", "API_URL"];
	const environmentsJson = JSON.stringify(ENVIRONMENT_LIST
		.reduce((obj, key) => ({...obj, [key]: Deno.env.get(key)}), {}));

	const developmentHotRefreshUrl = "https://raw.githubusercontent.com/pagoru/deno-web-serve/master/src/development-hot-refresh.js";
	const developmentHotRefreshResponse = await fetch(developmentHotRefreshUrl);
	const developmentHotRefresh = await developmentHotRefreshResponse.text();
	
	const indexFileText = (await Deno.readTextFile(currentPublicPath + 'index.html')).replace(
		/<!-- SCRIPT_ENVS -->/,
		`<script type="text/javascript">\n
		window.__env__ = ${environmentsJson}
	</script>`
	);
	const socketList: (WebSocket | undefined)[] = [];

	const DevelopmentFunctions = (() => {
		if (!isDevelopment) return undefined;

		console.log('>>> DEVELOPMENT MODE <<<');

		let lastChecksum: string | undefined;
		
		setInterval(async () => {
			let targetChecksum: string;
			try {
				const bundleText = await Deno.readTextFile(currentPublicPath + 'bundle.js');
				
				const data = new TextEncoder().encode(bundleText);
				const digest = await crypto.subtle.digest('sha-256', data.buffer);
				targetChecksum = new TextDecoder().decode(new Uint8Array(digest));
			} catch (e) {
				targetChecksum = 'Error';
				Deno.writeTextFileSync(currentPublicPath + 'bundle.js', 'test');
			}
			if (lastChecksum && lastChecksum !== targetChecksum) {
				const socketClientList = socketList.filter((ws?: WebSocket) => ws && ws?.readyState === ws.OPEN)
				console.log(`[${getCurrentDate()}] Sending changes to clients (${socketClientList.length})`)
				socketClientList.forEach((ws: WebSocket) => ws.send('reload'));
			}
			lastChecksum = targetChecksum;
		}, 20);

		const onRequestWebSocket = (request: Request) => {
			if (request.headers.get('upgrade') === 'websocket') {
				const { socket: ws, response } = Deno.upgradeWebSocket(request);
				socketList.push(ws);
				ws.onmessage = (m) => console.log(m)
				return response;
			}
		};

		const onRequestIndex = (): Response => {
			const indexText = indexFileText.replace(
				/<!-- SCRIPT_FOOTER -->/,
				`<script type="text/javascript">\n${developmentHotRefresh}</script>`
			);
			return new Response(indexText, {
				headers: {
					'content-type': 'text/html',
				},
			});
		};

		return {
			onRequestWebSocket,
			onRequestIndex,
		};
	})();
	
	
	if(isDevelopment) {
		setTimeout(() => {
			if(socketList.length === 0)
				open('http://localhost:1994')
		}, 500)
		watchPathProcess(indexFileName);
	}
	
	await serve(
		async (request: Request) => {
			const webSocketResponse = DevelopmentFunctions?.onRequestWebSocket(request);
			if (webSocketResponse) return webSocketResponse;

			const url = new URL(request.url);
			const filepath = url.pathname ? decodeURIComponent(url.pathname) : '';

			let file;
			if (filepath !== '/') {
				try {
					file = await Deno.open(currentPublicPath + filepath, { read: true });
				} catch {
					// ignore
				}
			}

			if (!file) {
				if (filepath?.split('/')?.pop()?.includes('.')) {
					return new Response('404 Not Found', { status: 404 });
				}

				const devResponse = DevelopmentFunctions?.onRequestIndex();
				if (devResponse) return devResponse;

				return new Response(indexFileText, {
					headers: {
						'content-type': 'text/html',
					},
				});
			}

			return new Response(file?.readable);
		},
		{ port: 1994 }
	);
	
}
