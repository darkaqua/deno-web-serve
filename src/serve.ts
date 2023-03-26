import { serve } from '$deno/http/server.ts';
import * as path from "$deno/path/mod.ts";
import {getCurrentFilePath} from "./utils.ts";

const watchPathProcess = async () => {
	const process = Deno.run({
		cmd: ['deno', 'run', '-A', '--watch=src/', getCurrentFilePath('watcher.ts')],
		stdout: 'piped',
		stderr: 'piped',
	});
	
	const [, , stderr] = await Promise.all([
		process.status(),
		process.output(),
		process.stderrOutput(),
	]);
	
	const error = new TextDecoder().decode(stderr);
	error ? console.error(error) : console.log(`Done!`);
	
	process.close();
}

export const webServe = async () => {
	const currentPublicPath = path.join(await Deno.cwd(), 'public/')
	const isDevelopment = Deno.env.get('ENVIRONMENT')! === 'DEVELOPMENT';

	if(isDevelopment)
		watchPathProcess();
	
	const ENVIRONMENT_LIST = ["ENVIRONMENT", "API_URL"];
	const environmentsJson = JSON.stringify(ENVIRONMENT_LIST
		.reduce((obj, key) => ({...obj, [key]: Deno.env.get(key)}), {}));

	const developmentHotRefresh = await Deno.readTextFile(
		getCurrentFilePath('development-hot-refresh.min.js')
	);
	
	const indexFileText = (await Deno.readTextFile(currentPublicPath + 'index.html')).replace(
		/<!-- SCRIPT_ENVS -->/,
		`<script type="text/javascript">\n
		window.__env__ = ${environmentsJson}
	</script>`
	);

	const DevelopmentFunctions = (() => {
		if (!isDevelopment) return undefined;

		console.log('>>> DEVELOPMENT MODE <<<');

		let lastChecksum: string | undefined;
		const socketList: (WebSocket | undefined)[] = [];

		setInterval(async () => {
			const bundleText = await Deno.readTextFile(currentPublicPath + 'bundle.js');

			const data = new TextEncoder().encode(bundleText);
			const digest = await crypto.subtle.digest('sha-256', data.buffer);
			const targetChecksum = new TextDecoder().decode(new Uint8Array(digest));

			if (lastChecksum && lastChecksum !== targetChecksum)
				socketList.forEach(
					(ws?: WebSocket) =>
						ws && ws?.readyState === WebSocket.OPEN && ws?.send('reload')
				);

			lastChecksum = targetChecksum;
		}, 100);

		const onRequestWebSocket = (request: Request) => {
			if (request.headers.get('upgrade') === 'websocket') {
				const { socket: ws, response } = Deno.upgradeWebSocket(request);

				const indexPos = socketList.push(ws);

				ws.onclose = () => {
					socketList[indexPos] = undefined;
				};

				return response;
			}
		};

		const onRequestIndex = async (): Promise<Response> => {
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

	serve(
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

				const devResponse = await DevelopmentFunctions?.onRequestIndex();
				if (devResponse) return devResponse;

				return new Response(indexFileText, {
					headers: {
						'content-type': 'text/html',
					},
				});
			}

			return new Response(file?.readable);
		},
		{ port: 8080 }
	);
	
}